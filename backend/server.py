"""
StockAuto - Brazilian Vehicle Classifieds Marketplace MVP
FastAPI + MongoDB + JWT Auth + Emergent Object Storage
"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import uuid
import bcrypt
import jwt
import logging
import unicodedata
import requests as http_requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Query, Form
from fastapi.responses import PlainTextResponse, Response as FastAPIResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# ============================================================================
# CONFIG
# ============================================================================
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@stockauto.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
APP_NAME = os.environ.get("APP_NAME", "stockauto")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("stockauto")

app = FastAPI(title="StockAuto API")
api = APIRouter(prefix="/api")

# ============================================================================
# HELPERS
# ============================================================================
CATEGORIES = [
    {"code": "carro", "label": "Carro"},
    {"code": "moto", "label": "Moto"},
    {"code": "camionete", "label": "Camionete"},
    {"code": "caminhao", "label": "Caminhão"},
    {"code": "onibus", "label": "Ônibus"},
    {"code": "nautico", "label": "Náutico"},
    {"code": "utilitario", "label": "Utilitário"},
    {"code": "implementos", "label": "Implementos"},
    {"code": "outros", "label": "Outros"},
]

DEFAULT_PLANS = [
    {"code": "avulso", "name": "Avulso", "price": 39.90, "ad_limit": 1},
    {"code": "loja", "name": "Loja", "price": 129.90, "ad_limit": 30},
]


def slugify(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9\s-]", "", text).strip().lower()
    text = re.sub(r"[-\s]+", "-", text)
    return text


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, kind: str = "access") -> str:
    minutes = 60 * 24  # 24h access for simpler MVP UX
    if kind == "refresh":
        delta = timedelta(days=7)
    else:
        delta = timedelta(minutes=minutes)
    payload = {"sub": user_id, "type": kind, "exp": datetime.now(timezone.utc) + delta}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, user_id: str):
    access = create_token(user_id, "access")
    refresh = create_token(user_id, "refresh")
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24 * 7, path="/")
    return access


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def _user_from_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        uid = payload.get("sub")
        user = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
        return user
    except jwt.PyJWTError:
        return None


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    user = await _user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada")
    return user


async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    return user


async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


# ============================================================================
# OBJECT STORAGE
# ============================================================================
storage_key: Optional[str] = None


def init_storage() -> Optional[str]:
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_LLM_KEY:
        logger.warning("EMERGENT_LLM_KEY not set — storage disabled")
        return None
    try:
        r = http_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        storage_key = r.json()["storage_key"]
        logger.info("Object storage initialized")
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage não inicializado")
    r = http_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if r.status_code == 403:
        # Re-init key once
        global storage_key
        storage_key = None
        key = init_storage()
        r = http_requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    r.raise_for_status()
    return r.json()


def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage não inicializado")
    r = http_requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if r.status_code == 403:
        global storage_key
        storage_key = None
        key = init_storage()
        r = http_requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


async def upload_image_to_storage(file: UploadFile, owner_id: str) -> str:
    ext = (file.filename or "image.jpg").split(".")[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{owner_id}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Imagem muito grande (máx 8 MB)")
    result = put_object(path, data, file.content_type or f"image/{'jpeg' if ext=='jpg' else ext}")
    return result["path"]


# ============================================================================
# MODELS (pydantic)
# ============================================================================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    store_name: str
    phone: str
    whatsapp: str
    city: str
    uf: str
    address: Optional[str] = ""
    description: Optional[str] = ""
    plan_code: Literal["avulso", "loja"] = "avulso"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class DealerUpdateIn(BaseModel):
    store_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    city: Optional[str] = None
    uf: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None


class VehicleIn(BaseModel):
    category: str
    brand: str
    model: str
    version: Optional[str] = ""
    year_made: int
    year_model: int
    km: Optional[int] = None
    transmission: Optional[str] = ""
    fuel: Optional[str] = ""
    color: Optional[str] = ""
    city: str
    uf: str
    price: Optional[float] = None  # None => "Consultar Valor"
    description: Optional[str] = ""
    photos: Optional[List[str]] = []  # storage paths


class AdminUserUpdateIn(BaseModel):
    status: Optional[str] = None  # pending / active / blocked
    plan_code: Optional[str] = None
    store_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    city: Optional[str] = None
    uf: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None


class AdminVehicleUpdateIn(VehicleIn):
    status: Optional[str] = None


class SettingsIn(BaseModel):
    pix_key: Optional[str] = None
    pix_holder_name: Optional[str] = None
    plans: Optional[List[dict]] = None


# ============================================================================
# HELPERS (DB)
# ============================================================================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def unique_slug(collection, base: str, current_id: Optional[str] = None) -> str:
    base = base or "item"
    slug = base
    i = 2
    while True:
        q = {"slug": slug}
        if current_id:
            q["id"] = {"$ne": current_id}
        if not await collection.find_one(q):
            return slug
        slug = f"{base}-{i}"
        i += 1


def public_user(u: dict) -> dict:
    """Sanitize user doc for API output (remove password_hash, _id)."""
    u = dict(u)
    u.pop("_id", None)
    u.pop("password_hash", None)
    return u


def public_dealer_card(u: dict) -> dict:
    return {
        "id": u.get("id"),
        "slug": u.get("slug"),
        "store_name": u.get("store_name"),
        "city": u.get("city"),
        "uf": u.get("uf"),
        "phone": u.get("phone"),
        "whatsapp": u.get("whatsapp"),
        "logo_path": u.get("logo_path"),
        "cover_path": u.get("cover_path"),
        "description": u.get("description"),
        "address": u.get("address"),
    }


async def vehicle_with_dealer(v: dict) -> dict:
    v = dict(v)
    v.pop("_id", None)
    dealer = await db.users.find_one({"id": v.get("dealer_id")}, {"_id": 0, "password_hash": 0})
    v["dealer"] = public_dealer_card(dealer) if dealer else None
    return v


async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {"id": "global", "pix_key": "stockauto@pix.com.br", "pix_holder_name": "StockAuto MVP", "plans": DEFAULT_PLANS}
        await db.settings.insert_one(s)
    return s


# ============================================================================
# AUTH ROUTES
# ============================================================================
@api.post("/auth/register")
async def auth_register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    plans = (await get_settings())["plans"]
    plan = next((p for p in plans if p["code"] == body.plan_code), plans[0])
    user_id = str(uuid.uuid4())
    slug_base = slugify(f"{body.store_name}-{body.city}")
    slug = await unique_slug(db.users, slug_base)
    user = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "role": "dealer",
        "status": "pending",  # pending → active by admin
        "store_name": body.store_name,
        "slug": slug,
        "phone": body.phone,
        "whatsapp": body.whatsapp,
        "city": body.city,
        "uf": body.uf.upper(),
        "address": body.address or "",
        "description": body.description or "",
        "logo_path": None,
        "cover_path": None,
        "plan_code": plan["code"],
        "plan_name": plan["name"],
        "plan_ad_limit": plan["ad_limit"],
        "plan_price": plan["price"],
        "payment_provider": "pix",
        "payment_status": "pending",
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    # Notification to admin
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "type": "new_dealer",
        "title": f"Novo revendedor: {body.store_name}",
        "body": f"{body.store_name} ({body.city}/{body.uf.upper()}) escolheu o plano {plan['name']}.",
        "user_id": user_id,
        "read": False,
        "created_at": now_iso(),
    })
    set_auth_cookies(response, user_id)
    return public_user(user)


@api.post("/auth/login")
async def auth_login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    set_auth_cookies(response, user["id"])
    return public_user(user)


@api.post("/auth/logout")
async def auth_logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


# ============================================================================
# PUBLIC ROUTES
# ============================================================================
@api.get("/categories")
async def list_categories():
    return CATEGORIES


@api.get("/settings/public")
async def public_settings():
    s = await get_settings()
    return {"pix_key": s.get("pix_key"), "pix_holder_name": s.get("pix_holder_name"), "plans": s.get("plans", DEFAULT_PLANS)}


@api.get("/vehicles")
async def list_vehicles(
    q: Optional[str] = None,
    category: Optional[str] = None,
    brand: Optional[str] = None,
    model: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    city: Optional[str] = None,
    uf: Optional[str] = None,
    dealer_id: Optional[str] = None,
    dealer_slug: Optional[str] = None,
    featured: Optional[bool] = None,
    limit: int = 30,
    skip: int = 0,
):
    filt: dict = {"status": "active"}
    if category:
        filt["category"] = category
    if brand:
        filt["brand"] = {"$regex": f"^{re.escape(brand)}$", "$options": "i"}
    if model:
        filt["model"] = {"$regex": re.escape(model), "$options": "i"}
    if year_min or year_max:
        filt["year_model"] = {}
        if year_min:
            filt["year_model"]["$gte"] = year_min
        if year_max:
            filt["year_model"]["$lte"] = year_max
    if price_min or price_max:
        filt["price"] = {}
        if price_min:
            filt["price"]["$gte"] = price_min
        if price_max:
            filt["price"]["$lte"] = price_max
    if city:
        filt["city"] = {"$regex": re.escape(city), "$options": "i"}
    if uf:
        filt["uf"] = uf.upper()
    if dealer_id:
        filt["dealer_id"] = dealer_id
    if dealer_slug:
        d = await db.users.find_one({"slug": dealer_slug})
        filt["dealer_id"] = d["id"] if d else "__none__"
    if q:
        rx = re.compile(re.escape(q), re.IGNORECASE)
        filt["$or"] = [{"brand": rx}, {"model": rx}, {"version": rx}, {"description": rx}, {"city": rx}]

    cur = db.vehicles.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(min(limit, 100))
    items = []
    async for v in cur:
        items.append(await vehicle_with_dealer(v))
    total = await db.vehicles.count_documents(filt)
    return {"items": items, "total": total}


@api.get("/vehicles/{slug_or_id}")
async def get_vehicle(slug_or_id: str):
    v = await db.vehicles.find_one({"$or": [{"slug": slug_or_id}, {"id": slug_or_id}], "status": {"$ne": "deleted"}}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    return await vehicle_with_dealer(v)


@api.get("/dealers")
async def list_dealers(featured: Optional[bool] = None, limit: int = 30):
    filt: dict = {"role": "dealer", "status": "active"}
    cur = db.users.find(filt, {"_id": 0, "password_hash": 0}).limit(min(limit, 100))
    out = []
    async for d in cur:
        # add count of active ads
        d["active_ads"] = await db.vehicles.count_documents({"dealer_id": d["id"], "status": "active"})
        out.append(public_dealer_card({**d, "active_ads": d["active_ads"]}) | {"active_ads": d["active_ads"]})
    return out


@api.get("/dealers/{slug_or_id}")
async def get_dealer(slug_or_id: str):
    d = await db.users.find_one({"$or": [{"slug": slug_or_id}, {"id": slug_or_id}], "role": "dealer"}, {"_id": 0, "password_hash": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Revendedor não encontrado")
    if d.get("status") != "active":
        raise HTTPException(status_code=404, detail="Revendedor indisponível")
    return public_dealer_card(d)


# ============================================================================
# DEALER (authenticated) ROUTES
# ============================================================================
def require_dealer(user: dict):
    if user.get("role") != "dealer":
        raise HTTPException(status_code=403, detail="Acesso de revendedor")
    return user


@api.put("/dealer/profile")
async def dealer_update_profile(body: DealerUpdateIn, user: dict = Depends(get_current_user)):
    require_dealer(user)
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if "store_name" in update or "city" in update:
        store_name = update.get("store_name", user.get("store_name"))
        city = update.get("city", user.get("city"))
        update["slug"] = await unique_slug(db.users, slugify(f"{store_name}-{city}"), current_id=user["id"])
    if "uf" in update and update["uf"]:
        update["uf"] = update["uf"].upper()
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return fresh


@api.post("/dealer/logo")
async def dealer_upload_logo(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    require_dealer(user)
    path = await upload_image_to_storage(file, user["id"])
    await db.users.update_one({"id": user["id"]}, {"$set": {"logo_path": path}})
    return {"logo_path": path}


@api.post("/dealer/cover")
async def dealer_upload_cover(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    require_dealer(user)
    path = await upload_image_to_storage(file, user["id"])
    await db.users.update_one({"id": user["id"]}, {"$set": {"cover_path": path}})
    return {"cover_path": path}


@api.post("/dealer/uploads")
async def dealer_upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    require_dealer(user)
    path = await upload_image_to_storage(file, user["id"])
    return {"path": path}


@api.get("/dealer/vehicles")
async def dealer_my_vehicles(user: dict = Depends(get_current_user)):
    require_dealer(user)
    cur = db.vehicles.find({"dealer_id": user["id"], "status": {"$ne": "deleted"}}, {"_id": 0}).sort("created_at", -1)
    return [v async for v in cur]


def vehicle_slug_base(v: dict) -> str:
    return slugify(f"{v['brand']}-{v['model']}-{v.get('version','')}-{v['year_model']}-{v['city']}".strip("-"))


@api.post("/dealer/vehicles")
async def dealer_create_vehicle(body: VehicleIn, user: dict = Depends(get_current_user)):
    require_dealer(user)
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Sua conta ainda não foi liberada pelo administrador.")
    count = await db.vehicles.count_documents({"dealer_id": user["id"], "status": {"$in": ["active", "pending"]}})
    if count >= int(user.get("plan_ad_limit", 1)):
        raise HTTPException(status_code=400, detail=f"Limite do plano atingido ({user.get('plan_ad_limit')} anúncios).")
    vid = str(uuid.uuid4())
    base_slug = vehicle_slug_base(body.model_dump())
    slug = await unique_slug(db.vehicles, base_slug)
    doc = body.model_dump()
    doc.update({
        "id": vid,
        "slug": slug,
        "dealer_id": user["id"],
        "status": "pending",  # admin must approve
        "uf": (doc.get("uf") or "").upper(),
        "main_photo": (doc.get("photos") or [None])[0],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await db.vehicles.insert_one(doc)
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "type": "new_ad",
        "title": f"Novo anúncio: {doc['brand']} {doc['model']} {doc['year_model']}",
        "body": f"Aguardando aprovação — {user.get('store_name')}",
        "vehicle_id": vid,
        "user_id": user["id"],
        "read": False,
        "created_at": now_iso(),
    })
    return {**doc, "_id": None}


@api.put("/dealer/vehicles/{vid}")
async def dealer_update_vehicle(vid: str, body: VehicleIn, user: dict = Depends(get_current_user)):
    require_dealer(user)
    v = await db.vehicles.find_one({"id": vid, "dealer_id": user["id"]})
    if not v:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    update = body.model_dump()
    update["uf"] = (update.get("uf") or "").upper()
    update["main_photo"] = (update.get("photos") or [None])[0]
    update["updated_at"] = now_iso()
    update["status"] = "pending"  # re-approval after edit
    update["slug"] = await unique_slug(db.vehicles, vehicle_slug_base(update), current_id=vid)
    await db.vehicles.update_one({"id": vid}, {"$set": update})
    return await db.vehicles.find_one({"id": vid}, {"_id": 0})


@api.delete("/dealer/vehicles/{vid}")
async def dealer_delete_vehicle(vid: str, user: dict = Depends(get_current_user)):
    require_dealer(user)
    res = await db.vehicles.update_one({"id": vid, "dealer_id": user["id"]}, {"$set": {"status": "deleted", "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    return {"ok": True}


# ============================================================================
# ADMIN ROUTES
# ============================================================================
@api.get("/admin/users")
async def admin_users(user: dict = Depends(get_admin_user)):
    cur = db.users.find({"role": "dealer"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1)
    return [u async for u in cur]


@api.put("/admin/users/{uid}")
async def admin_update_user(uid: str, body: AdminUserUpdateIn, user: dict = Depends(get_admin_user)):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if "uf" in update and update["uf"]:
        update["uf"] = update["uf"].upper()
    if "plan_code" in update:
        plans = (await get_settings())["plans"]
        plan = next((p for p in plans if p["code"] == update["plan_code"]), None)
        if plan:
            update["plan_name"] = plan["name"]
            update["plan_ad_limit"] = plan["ad_limit"]
            update["plan_price"] = plan["price"]
    if "store_name" in update or "city" in update:
        store_name = update.get("store_name", target.get("store_name"))
        city = update.get("city", target.get("city"))
        update["slug"] = await unique_slug(db.users, slugify(f"{store_name}-{city}"), current_id=uid)
    if update.get("status") == "active":
        update["payment_status"] = "paid"
    await db.users.update_one({"id": uid}, {"$set": update})
    return await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})


@api.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, user: dict = Depends(get_admin_user)):
    await db.users.delete_one({"id": uid, "role": "dealer"})
    await db.vehicles.update_many({"dealer_id": uid}, {"$set": {"status": "deleted"}})
    return {"ok": True}


@api.get("/admin/vehicles")
async def admin_vehicles(status: Optional[str] = None, user: dict = Depends(get_admin_user)):
    filt: dict = {}
    if status:
        filt["status"] = status
    cur = db.vehicles.find(filt, {"_id": 0}).sort("created_at", -1)
    out = []
    async for v in cur:
        out.append(await vehicle_with_dealer(v))
    return out


@api.put("/admin/vehicles/{vid}")
async def admin_update_vehicle(vid: str, body: AdminVehicleUpdateIn, user: dict = Depends(get_admin_user)):
    v = await db.vehicles.find_one({"id": vid})
    if not v:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    update = {k: val for k, val in body.model_dump().items() if val is not None}
    if "uf" in update and update["uf"]:
        update["uf"] = update["uf"].upper()
    if "photos" in update:
        update["main_photo"] = (update.get("photos") or [None])[0]
    update["updated_at"] = now_iso()
    if "brand" in update or "model" in update or "city" in update or "year_model" in update:
        merged = {**v, **update}
        update["slug"] = await unique_slug(db.vehicles, vehicle_slug_base(merged), current_id=vid)
    await db.vehicles.update_one({"id": vid}, {"$set": update})
    return await db.vehicles.find_one({"id": vid}, {"_id": 0})


@api.delete("/admin/vehicles/{vid}")
async def admin_delete_vehicle(vid: str, user: dict = Depends(get_admin_user)):
    await db.vehicles.update_one({"id": vid}, {"$set": {"status": "deleted"}})
    return {"ok": True}


@api.get("/admin/notifications")
async def admin_notifications(user: dict = Depends(get_admin_user)):
    cur = db.notifications.find({}, {"_id": 0}).sort("created_at", -1).limit(100)
    return [n async for n in cur]


@api.put("/admin/notifications/{nid}/read")
async def admin_mark_notification(nid: str, user: dict = Depends(get_admin_user)):
    await db.notifications.update_one({"id": nid}, {"$set": {"read": True}})
    return {"ok": True}


@api.get("/admin/settings")
async def admin_get_settings(user: dict = Depends(get_admin_user)):
    return await get_settings()


@api.put("/admin/settings")
async def admin_update_settings(body: SettingsIn, user: dict = Depends(get_admin_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.settings.update_one({"id": "global"}, {"$set": update}, upsert=True)
    return await get_settings()


# ============================================================================
# FILES (public read)
# ============================================================================
@api.get("/files/{path:path}")
async def serve_file(path: str):
    try:
        data, ctype = get_object(path)
    except http_requests.HTTPError as e:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado") from e
    return FastAPIResponse(content=data, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


# ============================================================================
# SEO: sitemap.xml + robots.txt
# ============================================================================
@api.get("/robots.txt", response_class=PlainTextResponse)
async def robots_txt(request: Request):
    base = str(request.base_url).rstrip("/")
    return f"User-agent: *\nAllow: /\nSitemap: {base}/api/sitemap.xml\n"


@api.get("/sitemap.xml")
async def sitemap_xml(request: Request):
    base = str(request.base_url).rstrip("/")
    urls = [f"{base}/", f"{base}/veiculos"]
    async for v in db.vehicles.find({"status": "active"}, {"slug": 1, "_id": 0}).limit(2000):
        urls.append(f"{base}/veiculo/{v['slug']}")
    async for d in db.users.find({"role": "dealer", "status": "active"}, {"slug": 1, "_id": 0}).limit(2000):
        urls.append(f"{base}/revendedor/{d['slug']}")
    body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for u in urls:
        body += f"  <url><loc>{u}</loc></url>\n"
    body += "</urlset>\n"
    return FastAPIResponse(content=body, media_type="application/xml")


# ============================================================================
# HEALTH
# ============================================================================
@api.get("/")
async def root():
    return {"app": "StockAuto", "ok": True}


# ============================================================================
# SEED + STARTUP
# ============================================================================
SEED_PHOTOS = {
    "carro": [
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200",
        "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1200",
        "https://images.unsplash.com/photo-1542362567-b07e54358753?w=1200",
        "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200",
        "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200",
        "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200",
    ],
    "moto": [
        "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200",
        "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200",
    ],
    "camionete": [
        "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200",
        "https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=1200",
    ],
    "caminhao": [
        "https://images.unsplash.com/photo-1592805144716-feeccccef5ac?w=1200",
    ],
    "utilitario": [
        "https://images.unsplash.com/photo-1612544448445-b8232cff3b6c?w=1200",
    ],
}


SEED_VEHICLES = [
    {"category": "carro", "brand": "Toyota", "model": "Corolla", "version": "XEi 2.0", "year_made": 2020, "year_model": 2021, "km": 45000, "transmission": "Automático", "fuel": "Flex", "color": "Prata", "city": "Goiânia", "uf": "GO", "price": 119900.00, "description": "Único dono, revisões na concessionária, todos os opcionais."},
    {"category": "carro", "brand": "Honda", "model": "Civic", "version": "EXL", "year_made": 2019, "year_model": 2019, "km": 62000, "transmission": "CVT", "fuel": "Flex", "color": "Preto", "city": "Goiânia", "uf": "GO", "price": 109500.00, "description": "Carro impecável, segundo dono."},
    {"category": "carro", "brand": "Volkswagen", "model": "T-Cross", "version": "Highline 1.4 TSI", "year_made": 2022, "year_model": 2023, "km": 22000, "transmission": "Automático", "fuel": "Flex", "color": "Branco", "city": "São Paulo", "uf": "SP", "price": 149900.00, "description": "Garantia de fábrica, multimídia."},
    {"category": "carro", "brand": "Jeep", "model": "Compass", "version": "Longitude Diesel 4x4", "year_made": 2021, "year_model": 2022, "km": 38000, "transmission": "Automático", "fuel": "Diesel", "color": "Cinza", "city": "São Paulo", "uf": "SP", "price": None, "description": "Diesel 4x4, completíssimo. Aceita troca."},
    {"category": "carro", "brand": "Fiat", "model": "Argo", "version": "Drive 1.3", "year_made": 2021, "year_model": 2021, "km": 31000, "transmission": "Manual", "fuel": "Flex", "color": "Vermelho", "city": "Belo Horizonte", "uf": "MG", "price": 67900.00, "description": "Econômico, ideal para o dia a dia."},
    {"category": "camionete", "brand": "Toyota", "model": "Hilux", "version": "SRX 2.8 4x4", "year_made": 2020, "year_model": 2021, "km": 78000, "transmission": "Automático", "fuel": "Diesel", "color": "Branco", "city": "Belo Horizonte", "uf": "MG", "price": 289900.00, "description": "Diesel automática, top de linha."},
    {"category": "camionete", "brand": "Ford", "model": "Ranger", "version": "XLT 3.2", "year_made": 2019, "year_model": 2019, "km": 95000, "transmission": "Automático", "fuel": "Diesel", "color": "Preto", "city": "Goiânia", "uf": "GO", "price": None, "description": "Couro, multimídia, revisada."},
    {"category": "moto", "brand": "Honda", "model": "CB 500F", "version": "ABS", "year_made": 2022, "year_model": 2022, "km": 8000, "transmission": "Manual", "fuel": "Gasolina", "color": "Vermelho", "city": "São Paulo", "uf": "SP", "price": 38900.00, "description": "Pouquíssimo rodada."},
    {"category": "moto", "brand": "Yamaha", "model": "MT-07", "version": "ABS", "year_made": 2021, "year_model": 2021, "km": 14000, "transmission": "Manual", "fuel": "Gasolina", "color": "Azul", "city": "Belo Horizonte", "uf": "MG", "price": 49500.00, "description": "Esportiva, revisões em dia."},
    {"category": "caminhao", "brand": "Mercedes-Benz", "model": "Actros 2651", "version": "6x4", "year_made": 2018, "year_model": 2018, "km": 480000, "transmission": "Automatizado", "fuel": "Diesel", "color": "Branco", "city": "Goiânia", "uf": "GO", "price": None, "description": "Cavalo mecânico, pronto para trabalho pesado."},
    {"category": "utilitario", "brand": "Fiat", "model": "Fiorino", "version": "Endurance", "year_made": 2022, "year_model": 2022, "km": 38000, "transmission": "Manual", "fuel": "Flex", "color": "Branco", "city": "São Paulo", "uf": "SP", "price": 89900.00, "description": "Ideal para entregas, revisada."},
    {"category": "carro", "brand": "Chevrolet", "model": "Onix", "version": "LTZ Turbo", "year_made": 2023, "year_model": 2024, "km": 12000, "transmission": "Automático", "fuel": "Flex", "color": "Cinza", "city": "Belo Horizonte", "uf": "MG", "price": 99900.00, "description": "Praticamente zero, IPVA pago."},
]


async def seed_demo():
    if await db.vehicles.count_documents({}) > 0:
        logger.info("Seed: vehicles já existem, pulando.")
        return
    dealers_seed = [
        {"email": "contato@autocentersilva.com", "store_name": "Auto Center Silva", "city": "Goiânia", "uf": "GO", "phone": "(62) 3333-1111", "whatsapp": "5562999991111", "address": "Av. T-7, 1000 - Setor Bueno", "description": "Há mais de 20 anos no mercado de Goiânia, oferecendo veículos seminovos selecionados."},
        {"email": "vendas@premiummotors.com", "store_name": "Premium Motors", "city": "São Paulo", "uf": "SP", "phone": "(11) 4002-8922", "whatsapp": "5511999992222", "address": "Av. Paulista, 2200 - Bela Vista", "description": "Especialista em veículos premium e seminovos com garantia."},
        {"email": "atendimento@garagemnacional.com", "store_name": "Garagem Nacional", "city": "Belo Horizonte", "uf": "MG", "phone": "(31) 3777-2233", "whatsapp": "5531999993333", "address": "Av. do Contorno, 5000 - Funcionários", "description": "Estoque variado, financiamento facilitado e troca aceita."},
    ]
    dealer_ids = []
    for d in dealers_seed:
        uid = str(uuid.uuid4())
        slug = await unique_slug(db.users, slugify(f"{d['store_name']}-{d['city']}"))
        user = {
            "id": uid,
            "email": d["email"],
            "password_hash": hash_password("Dealer@123"),
            "role": "dealer",
            "status": "active",
            "store_name": d["store_name"],
            "slug": slug,
            "phone": d["phone"],
            "whatsapp": d["whatsapp"],
            "city": d["city"],
            "uf": d["uf"],
            "address": d["address"],
            "description": d["description"],
            "logo_path": None,
            "cover_path": None,
            "plan_code": "loja",
            "plan_name": "Loja",
            "plan_ad_limit": 30,
            "plan_price": 129.90,
            "payment_provider": "pix",
            "payment_status": "paid",
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
        dealer_ids.append(uid)
    # Vehicles round-robin
    for idx, vraw in enumerate(SEED_VEHICLES):
        dealer_id = dealer_ids[idx % len(dealer_ids)]
        photos = SEED_PHOTOS.get(vraw["category"], SEED_PHOTOS["carro"])
        v = dict(vraw)
        v.update({
            "id": str(uuid.uuid4()),
            "slug": await unique_slug(db.vehicles, vehicle_slug_base(v)),
            "dealer_id": dealer_id,
            "status": "active",
            "photos": photos[: 3 + (idx % 3)],
            "main_photo": photos[0],
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
        await db.vehicles.insert_one(v)
    logger.info(f"Seed: criados {len(dealer_ids)} revendedores e {len(SEED_VEHICLES)} anúncios")


async def seed_admin():
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "status": "active",
            "store_name": "Administrador",
            "slug": "admin",
            "created_at": now_iso(),
        })
        logger.info("Admin seeded")
    elif not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("slug")
    await db.vehicles.create_index("slug")
    await db.vehicles.create_index("dealer_id")
    await db.vehicles.create_index([("category", 1), ("uf", 1)])
    init_storage()
    await seed_admin()
    await seed_demo()
    await get_settings()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# Mount router + CORS
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)
