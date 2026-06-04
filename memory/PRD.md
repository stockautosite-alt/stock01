# StockAuto — Product Requirements Document

## Visão Geral
StockAuto é um marketplace web responsivo de classificados de veículos focado em conectar compradores diretamente aos revendedores via WhatsApp, sem intermediação. PT-BR.

## Requisitos do Produto (originais)
- Home institucional + busca rápida
- Listagem de veículos com filtros (categoria, marca, modelo, ano, preço, cidade/UF)
- Página de Anúncio (detalhe) com galeria, specs, CTA WhatsApp em destaque
- Perfil / Mini-site do Revendedor com logo, capa, descrição, inventário ativo
- Cadastro e Painel do Revendedor (gerenciar anúncios, perfil, plano)
- Painel ADM Master (aprovar revendedores, moderar anúncios, notificações, settings PIX)
- Planos: **Avulso** (1 anúncio) e **Loja** (30 anúncios)
- **Pagamento manual via PIX** — sem Stripe. Admin aprova manualmente após confirmação.
- SEO local (slug por cidade/UF), alt tags geradas a partir dos dados do veículo
- Armazenamento de imagens via Object Storage (Emergent)
- Autenticação customizada (JWT em cookie HttpOnly)

## Personas
- **Comprador anônimo**: navega, filtra, contata revendedor por WhatsApp.
- **Revendedor**: cadastra, paga via PIX, gerencia anúncios e mini-site.
- **Admin Master**: aprova revendedores, modera anúncios, configura PIX e planos.

## Arquitetura
- **Backend**: FastAPI + Motor (MongoDB) + PyJWT (cookie) — `/app/backend/server.py`
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn UI — `/app/frontend/src/`
- **Storage**: Emergent Object Storage via `/api/files` proxy
- **Auth**: JWT em cookie `withCredentials: true`

## Esquemas (MongoDB)
- `users`: email, password_hash, role (admin|dealer), name, store_name, slug, phone, whatsapp, address, city, uf, plano, status, logo_path, cover_path, description
- `vehicles`: dealer_id, category, brand, model, version, year_made, year_model, km, transmission, fuel, color, city, uf, price, description, photos[], main_photo, slug, status, created_at
- `categories`: code, label
- `settings`: pix_key, pix_holder_name, plans[]
- `notifications`: type, payload, read, created_at

## Endpoints públicos
- `GET /api/categories` · `GET /api/settings/public`
- `GET /api/vehicles?...filtros` · `GET /api/vehicles/{slug_or_id}`
- `GET /api/dealers` · `GET /api/dealers/{slug_or_id}`
- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- `GET /api/files/{path}`

## Implementado (até 06/2026)
- 06/2026 — Backend FastAPI completo (auth, vehicles, dealers, admin, files, sitemap/robots)
- 06/2026 — Componentes base: Layout, VehicleCard, WhatsAppButton, ProtectedRoute
- 06/2026 — Página **Home** completa com hero, busca, categorias, veículos em destaque, revendedores, CTA
- 06/2026 — Páginas públicas: Listagem (`Listing.jsx`), Detalhe do veículo (`VehicleDetail.jsx`), Lista de revendedores (`DealerList.jsx`), Perfil do revendedor (`DealerProfile.jsx`)
- 06/2026 — `App.js` com BrowserRouter + AuthProvider + Layout + rotas
- 06/2026 — Páginas de autenticação: `Login.jsx` (split brand panel + form) e `Register.jsx` (3 seções: plano → dados da loja → acesso, com aviso de fluxo PIX manual). Integração via `AuthContext` (cookie JWT). Verificado em smoke test com admin → redirect `/admin` → `/api/auth/me` 200.

## Backlog priorizado

### P0 — próximas entregas
- `pages/DealerPanel.jsx` — painel revendedor (anúncios, perfil, plano, status PIX pendente)
- `pages/AdminPanel.jsx` — painel admin (aprovar revendedores, moderar anúncios, notificações, settings PIX)

### P1
- Fluxo PIX manual completo (pendente → admin aprova → ativa plano)
- Upload de imagens com progresso (revendedor)
- SEO: meta tags por página, OpenGraph, JSON-LD VehicleOffer, sitemap dinâmico

### P2
- E2E com testing_agent_v3_fork (todos os fluxos)
- Favoritos / comparação
- Notificações por e-mail (Resend)

## Credenciais de teste
Ver `/app/memory/test_credentials.md`.
