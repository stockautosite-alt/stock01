import { useEffect, useState, useCallback } from "react";
import api, { fileUrl } from "@/lib/api";
import PanelLayout from "@/components/PanelLayout";
import { APANEL } from "@/constants/testIds";
import { brl, km, UF_STATES } from "@/lib/format";
import {
  LayoutDashboard, Users, Car, Bell, Settings as SettingsIcon,
  Check, X, Trash2, Store, Clock, CheckCircle2, RefreshCw, ArrowRight, Image as ImageIcon,
  Pencil, Eye, EyeOff,
} from "lucide-react";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, testId: APANEL.tabDashboard },
  { key: "dealers", label: "Revendedores", icon: Users, testId: APANEL.tabDealers },
  { key: "vehicles", label: "Moderação", icon: Car, testId: APANEL.tabVehicles },
  { key: "notifications", label: "Notificações", icon: Bell, testId: APANEL.tabNotifications },
  { key: "settings", label: "Pagamento", icon: SettingsIcon, testId: APANEL.tabSettings },
];

export default function AdminPanel() {
  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState(null);

  const loadStats = useCallback(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  useEffect(() => { loadStats(); }, [loadStats, tab]);

  return (
    <PanelLayout
      testIdPage={APANEL.page}
      subtitle="ADM Master"
      title="Controle StockAuto"
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      rightHeader={
        stats?.dealers_pending > 0 || stats?.vehicles_pending > 0 ? (
          <div className="inline-flex items-center gap-2 bg-[#FF3B30] text-white px-4 py-2 text-xs font-bold uppercase tracking-tight">
            <Bell size={14} /> {(stats.dealers_pending || 0) + (stats.vehicles_pending || 0)} pendência(s)
          </div>
        ) : null
      }
    >
      {tab === "dashboard" && <DashboardTab stats={stats} onGo={setTab} />}
      {tab === "dealers" && <DealersTab onChanged={loadStats} />}
      {tab === "vehicles" && <VehiclesTab onChanged={loadStats} />}
      {tab === "notifications" && <NotificationsTab onChanged={loadStats} />}
      {tab === "settings" && <SettingsTab />}
    </PanelLayout>
  );
}

/* ---------------------------------------------------------------- Dashboard */
function DashboardTab({ stats, onGo }) {
  const cards = [
    { testId: APANEL.statDealers, label: "Lojistas", value: stats?.dealers_total, sub: `${stats?.dealers_active || 0} ativos`, icon: Store, accent: false },
    { testId: APANEL.statPendingDealers, label: "Lojistas pendentes", value: stats?.dealers_pending, sub: "aguardando aprovação", icon: Clock, accent: (stats?.dealers_pending || 0) > 0, go: "dealers" },
    { testId: APANEL.statActiveVehicles, label: "Anúncios ativos", value: stats?.vehicles_active, sub: `${stats?.vehicles_total || 0} no total`, icon: CheckCircle2, accent: false },
    { testId: APANEL.statPendingVehicles, label: "Anúncios pendentes", value: stats?.vehicles_pending, sub: "aguardando moderação", icon: Car, accent: (stats?.vehicles_pending || 0) > 0, go: "vehicles" },
  ];
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              data-testid={c.testId}
              onClick={() => c.go && onGo(c.go)}
              className={`text-left p-6 border transition-all ${c.accent ? "bg-[#FF3B30] text-white border-[#FF3B30]" : "bg-white border-zinc-200 hover:border-black"}`}
            >
              <div className="flex items-center justify-between">
                <Icon size={20} className={c.accent ? "text-white" : "text-zinc-400"} />
                {c.go && <ArrowRight size={16} className={c.accent ? "text-white" : "text-zinc-300"} />}
              </div>
              <div className="mt-6 text-5xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
                {c.value ?? "—"}
              </div>
              <div className="mt-2 text-xs uppercase tracking-widest font-bold">{c.label}</div>
              <div className={`mt-1 text-xs ${c.accent ? "text-white/80" : "text-zinc-500"}`}>{c.sub}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        <button onClick={() => onGo("dealers")} className="text-left p-6 bg-black text-white hover:bg-zinc-800 transition-colors">
          <Users size={20} className="text-[#FF3B30]" />
          <div className="mt-4 text-xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>Aprovar revendedores</div>
          <p className="mt-1 text-sm text-zinc-300">Confirme o pagamento PIX e libere o acesso ao painel.</p>
        </button>
        <button onClick={() => onGo("vehicles")} className="text-left p-6 bg-black text-white hover:bg-zinc-800 transition-colors">
          <Car size={20} className="text-[#FF3B30]" />
          <div className="mt-4 text-xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>Moderar anúncios</div>
          <p className="mt-1 text-sm text-zinc-300">Revise e publique os anúncios enviados pelas lojas.</p>
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Dealers */
const DEALER_STATUS = {
  active: { label: "Ativo", cls: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  blocked: { label: "Bloqueado", cls: "bg-red-100 text-red-700" },
};

function DealersTab({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/admin/users").then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (uid, status) => {
    await api.put(`/admin/users/${uid}`, { status });
    load(); onChanged?.();
  };
  const remove = async (uid) => {
    await api.delete(`/admin/users/${uid}`);
    setConfirmDelete(null); load(); onChanged?.();
  };

  const filtered = items.filter((d) => filter === "all" || d.status === filter);
  const counts = {
    all: items.length,
    pending: items.filter((d) => d.status === "pending").length,
    active: items.filter((d) => d.status === "active").length,
    blocked: items.filter((d) => d.status === "blocked").length,
  };

  return (
    <div>
      <FilterPills
        options={[
          { k: "all", label: `Todos (${counts.all})` },
          { k: "pending", label: `Pendentes (${counts.pending})` },
          { k: "active", label: `Ativos (${counts.active})` },
          { k: "blocked", label: `Bloqueados (${counts.blocked})` },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {loading ? (
        <div className="mt-8 text-zinc-500">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Empty label="Nenhum revendedor neste filtro." />
      ) : (
        <div className="mt-6 border border-zinc-200 divide-y divide-zinc-200 bg-white">
          {filtered.map((d) => {
            const s = DEALER_STATUS[d.status] || DEALER_STATUS.pending;
            return (
              <div key={d.id} data-testid={APANEL.dealerRow(d.id)} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-zinc-50">
                <div className="w-12 h-12 bg-zinc-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {d.logo_path ? <img src={fileUrl(d.logo_path)} alt={d.store_name} className="w-full h-full object-cover" /> : <Store size={18} className="text-zinc-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold tracking-tight truncate">{d.store_name}</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {d.email} · {d.city}/{d.uf} · Plano <span className="font-bold">{d.plan_name}</span> ({brl(d.plan_price)})
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.status !== "active" && (
                    <button data-testid={APANEL.dealerApprove(d.id)} onClick={() => act(d.id, "active")}
                      className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 h-9 text-xs font-bold uppercase tracking-tight">
                      <Check size={14} /> Aprovar
                    </button>
                  )}
                  {d.status !== "blocked" ? (
                    <button data-testid={APANEL.dealerBlock(d.id)} onClick={() => act(d.id, "blocked")}
                      className="inline-flex items-center gap-1 border border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30] px-3 h-9 text-xs font-bold uppercase tracking-tight">
                      <X size={14} /> Bloquear
                    </button>
                  ) : (
                    <button onClick={() => act(d.id, "active")}
                      className="inline-flex items-center gap-1 border border-zinc-300 hover:border-black px-3 h-9 text-xs font-bold uppercase tracking-tight">
                      <RefreshCw size={14} /> Reativar
                    </button>
                  )}
                  <button data-testid={`apanel-dealer-edit-${d.id}`} onClick={() => setEditing(d)}
                    className="p-2.5 border border-zinc-300 hover:border-black" aria-label="Editar">
                    <Pencil size={16} />
                  </button>
                  <button data-testid={APANEL.dealerDelete(d.id)} onClick={() => setConfirmDelete(d)}
                    className="p-2.5 border border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30]" aria-label="Excluir">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Excluir revendedor?"
          body={`Remover "${confirmDelete.store_name}"? Todos os anúncios desta loja serão removidos. Esta ação não pode ser desfeita.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete.id)}
        />
      )}

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); onChanged?.(); }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Vehicles */
const VEH_STATUS = {
  active: { label: "Ativo", cls: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  blocked: { label: "Bloqueado", cls: "bg-red-100 text-red-700" },
};

function VehiclesTab({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  const load = useCallback(() => {
    setLoading(true);
    const params = filter === "all" ? {} : { status: filter };
    api.get("/admin/vehicles", { params }).then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (vid, status) => {
    await api.put(`/admin/vehicles/${vid}/status`, { status });
    load(); onChanged?.();
  };

  return (
    <div>
      <FilterPills
        testId={APANEL.vehicleStatusFilter}
        options={[
          { k: "pending", label: "Pendentes" },
          { k: "active", label: "Ativos" },
          { k: "blocked", label: "Bloqueados" },
          { k: "all", label: "Todos" },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {loading ? (
        <div className="mt-8 text-zinc-500">Carregando…</div>
      ) : items.length === 0 ? (
        <Empty label="Nenhum anúncio neste filtro." />
      ) : (
        <div className="mt-6 border border-zinc-200 divide-y divide-zinc-200 bg-white">
          {items.map((v) => {
            const s = VEH_STATUS[v.status] || VEH_STATUS.pending;
            return (
              <div key={v.id} data-testid={APANEL.vehicleRow(v.id)} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-zinc-50">
                <div className="w-20 h-16 bg-zinc-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {v.main_photo ? <img src={fileUrl(v.main_photo)} alt={`${v.brand} ${v.model}`} className="w-full h-full object-cover" /> : <ImageIcon size={18} className="text-zinc-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold tracking-tight truncate">{v.brand} {v.model} <span className="font-normal text-zinc-500">{v.version}</span></span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {v.year_made}/{v.year_model} · {km(v.km)} · {v.city}/{v.uf} · <span className="font-bold text-black">{brl(v.price)}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">Loja: {v.dealer?.store_name || "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  {v.status !== "active" && (
                    <button data-testid={APANEL.vehicleApprove(v.id)} onClick={() => setStatus(v.id, "active")}
                      className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 h-9 text-xs font-bold uppercase tracking-tight">
                      <Check size={14} /> Aprovar
                    </button>
                  )}
                  {v.status !== "blocked" ? (
                    <button data-testid={APANEL.vehicleReject(v.id)} onClick={() => setStatus(v.id, "blocked")}
                      className="inline-flex items-center gap-1 border border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30] px-3 h-9 text-xs font-bold uppercase tracking-tight">
                      <X size={14} /> Reprovar
                    </button>
                  ) : (
                    <button onClick={() => setStatus(v.id, "active")}
                      className="inline-flex items-center gap-1 border border-zinc-300 hover:border-black px-3 h-9 text-xs font-bold uppercase tracking-tight">
                      <RefreshCw size={14} /> Republicar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Notifications */
function NotificationsTab({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/admin/notifications").then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    await api.put(`/admin/notifications/${id}/read`);
    load(); onChanged?.();
  };

  if (loading) return <div className="mt-8 text-zinc-500">Carregando…</div>;
  if (items.length === 0) return <Empty label="Nenhuma notificação." />;

  return (
    <div className="border border-zinc-200 divide-y divide-zinc-200 bg-white">
      {items.map((n) => (
        <div key={n.id} data-testid={APANEL.notifRow(n.id)} className={`p-4 flex items-start gap-4 ${n.read ? "opacity-60" : ""}`}>
          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${n.read ? "bg-zinc-300" : "bg-[#FF3B30]"}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{n.type === "new_dealer" ? "Novo lojista" : n.type === "new_ad" ? "Novo anúncio" : n.type}</span>
            </div>
            <div className="font-bold tracking-tight">{n.title}</div>
            <div className="text-sm text-zinc-600">{n.body}</div>
            <div className="text-xs text-zinc-400 mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
          </div>
          {!n.read && (
            <button data-testid={APANEL.notifMarkRead(n.id)} onClick={() => markRead(n.id)}
              className="inline-flex items-center gap-1 border border-zinc-300 hover:border-black px-3 h-9 text-xs font-bold uppercase tracking-tight">
              <Check size={14} /> Marcar lida
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Settings */
function SettingsTab() {
  const [pixKey, setPixKey] = useState("");
  const [holder, setHolder] = useState("");
  const [plans, setPlans] = useState([]);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/settings").then(({ data }) => {
      setPixKey(data.pix_key || "");
      setHolder(data.pix_holder_name || "");
      setPlans(data.plans || []);
    });
  }, []);

  const setPlanField = (code, field, value) =>
    setPlans((p) => p.map((pl) => (pl.code === code ? { ...pl, [field]: field === "name" ? value : Number(value) } : pl)));

  const planTestId = (code) => (code === "avulso" ? APANEL.settingsPlanAvulsoPrice : code === "loja" ? APANEL.settingsPlanLojaPrice : `apanel-settings-plan-${code}-price`);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setOk(false); setError("");
    try {
      await api.put("/admin/settings", { pix_key: pixKey, pix_holder_name: holder, plans });
      setOk(true); setTimeout(() => setOk(false), 2200);
    } catch (err) {
      setError(err?.response?.data?.detail || "Erro ao salvar.");
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="max-w-3xl space-y-8">
      {error && <div className="border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>}
      {ok && <div className="border-l-4 border-emerald-500 bg-emerald-50 text-emerald-800 text-sm px-4 py-2">Configurações salvas!</div>}

      <div className="bg-white border border-zinc-200 p-6">
        <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">Recebimento PIX</div>
        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          <Field label="Chave PIX">
            <input data-testid={APANEL.settingsPix} value={pixKey} onChange={(e) => setPixKey(e.target.value)} required
              className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
          </Field>
          <Field label="Titular da conta">
            <input data-testid={APANEL.settingsPixHolder} value={holder} onChange={(e) => setHolder(e.target.value)} required
              className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
          </Field>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 p-6">
        <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">Planos</div>
        <div className="mt-5 space-y-4">
          {plans.map((pl) => (
            <div key={pl.code} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end border-b border-zinc-100 pb-4">
              <Field label="Nome do plano">
                <input value={pl.name} onChange={(e) => setPlanField(pl.code, "name", e.target.value)}
                  className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
              </Field>
              <Field label="Preço (R$)">
                <input data-testid={planTestId(pl.code)} type="number" step="0.01" value={pl.price}
                  onChange={(e) => setPlanField(pl.code, "price", e.target.value)}
                  className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
              </Field>
              <Field label="Limite de anúncios">
                <input type="number" value={pl.ad_limit} onChange={(e) => setPlanField(pl.code, "ad_limit", e.target.value)}
                  className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
              </Field>
            </div>
          ))}
        </div>
      </div>

      <button data-testid={APANEL.settingsSubmit} type="submit" disabled={saving}
        className="bg-black hover:bg-zinc-800 text-white px-8 h-12 font-bold uppercase tracking-tight text-sm disabled:opacity-60">
        {saving ? "Salvando…" : "Salvar configurações"}
      </button>
    </form>
  );
}

/* ---------------------------------------------------------------- Shared */
function FilterPills({ options, value, onChange, testId }) {
  return (
    <div data-testid={testId} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.k} onClick={() => onChange(o.k)}
          className={`px-4 h-9 text-xs font-bold uppercase tracking-tight border transition-colors ${value === o.k ? "bg-black text-white border-black" : "border-zinc-300 hover:border-black"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Empty({ label }) {
  return <div className="mt-8 border-2 border-dashed border-zinc-300 py-16 text-center text-zinc-500">{label}</div>;
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ConfirmModal({ title, body, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4">
      <div className="bg-white max-w-md w-full p-6" data-testid="apanel-confirm-modal">
        <div className="text-xl font-black tracking-tighter">{title}</div>
        <div className="mt-2 text-sm text-zinc-600">{body}</div>
        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className="flex-1 h-11 border border-zinc-300 font-bold uppercase tracking-tight text-sm">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 h-11 bg-[#FF3B30] hover:bg-[#E13128] text-white font-bold uppercase tracking-tight text-sm">Excluir</button>
        </div>
      </div>
    </div>
  );
}


function EInput({ testid, value, onChange, type = "text" }) {
  return (
    <input
      data-testid={testid}
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
    />
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({
    store_name: user.store_name || "",
    email: user.email || "",
    phone: user.phone || "",
    whatsapp: user.whatsapp || "",
    city: user.city || "",
    uf: user.uf || "",
    address: user.address || "",
    description: user.description || "",
    plan_code: user.plan_code || "avulso",
  });
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/settings/public").then(({ data }) => setPlans(data.plans || [])).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const payload = { ...form };
      if (password) payload.password = password;
      await api.put(`/admin/users/${user.id}`, payload);
      onSaved?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Erro ao salvar.");
      setSaving(false);
    }
  };

  const planOptions = plans.length ? plans : [{ code: "avulso", name: "Avulso" }, { code: "loja", name: "Loja" }];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white max-w-2xl w-full" data-testid="apanel-edit-user-modal">
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">Editar revendedor</div>
            <div className="text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>{user.store_name}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100" aria-label="Fechar"><X size={20} /></button>
        </div>

        <form onSubmit={save} className="p-6 space-y-5">
          {error && <div className="border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome da loja"><EInput value={form.store_name} onChange={(v) => set("store_name", v)} /></Field>
            <Field label="E-mail (login)"><EInput testid="apanel-edit-email" type="email" value={form.email} onChange={(v) => set("email", v)} /></Field>
            <Field label="Telefone"><EInput value={form.phone} onChange={(v) => set("phone", v)} /></Field>
            <Field label="WhatsApp"><EInput value={form.whatsapp} onChange={(v) => set("whatsapp", v)} /></Field>
            <Field label="Cidade"><EInput value={form.city} onChange={(v) => set("city", v)} /></Field>
            <Field label="UF">
              <select value={form.uf} onChange={(e) => set("uf", e.target.value)} className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white">
                <option value="">—</option>
                {UF_STATES.map((u) => <option key={u.code} value={u.code}>{u.code} - {u.name}</option>)}
              </select>
            </Field>
            <Field label="Plano">
              <select data-testid="apanel-edit-plan" value={form.plan_code} onChange={(e) => set("plan_code", e.target.value)} className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white">
                {planOptions.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Redefinir senha (opcional)">
              <div className="relative">
                <input
                  data-testid="apanel-edit-password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Deixe vazio para manter"
                  className="w-full h-12 px-4 pr-12 border border-zinc-300 focus:border-black outline-none bg-white"
                />
                <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black" aria-label="Mostrar senha">
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Endereço"><EInput value={form.address} onChange={(v) => set("address", v)} /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Descrição">
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className="w-full px-4 py-3 border border-zinc-300 focus:border-black outline-none" />
              </Field>
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-zinc-200">
            <button type="button" onClick={onClose} className="flex-1 h-12 border border-zinc-300 hover:border-black font-bold uppercase tracking-tight">Cancelar</button>
            <button type="submit" data-testid="apanel-edit-submit" disabled={saving} className="flex-1 h-12 bg-black hover:bg-zinc-800 disabled:opacity-60 text-white font-bold uppercase tracking-tight">{saving ? "Salvando…" : "Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
