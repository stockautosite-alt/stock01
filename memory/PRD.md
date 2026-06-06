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

## Posicionamento
Foco em **Campo Grande - MS**: "As melhores ofertas de Campo Grande em um só lugar."

## Implementado (até 06/2026)
- 06/2026 — Backend FastAPI completo (auth, vehicles, dealers, admin, files, sitemap/robots)
- 06/2026 — Componentes base: Layout, VehicleCard, WhatsAppButton, ProtectedRoute
- 06/2026 — Página **Home**, Listagem, Detalhe, Lista/Perfil de revendedores, Login, Cadastro
- 06/2026 — **Importado do GitHub** (stockautosite-alt/stock01) e configurado no ambiente Emergent (JWT_SECRET + EMERGENT_LLM_KEY adicionados). Teste E2E inicial 32/32 OK.
- 06/2026 — **Rotas protegidas**: `/painel` (dealer) e `/admin` (admin) via `ProtectedRoute` (removidos placeholders ComingSoon).
- 06/2026 — **Painel ADM Master** (`AdminPanel.jsx`): Dashboard com métricas (GET /api/admin/stats), gestão de revendedores (aprovar/bloquear/excluir), moderação de anúncios (aprovar/reprovar via PUT /api/admin/vehicles/{id}/status), notificações (marcar lida), config PIX + preços dos planos.
- 06/2026 — **SEO local Campo Grande**: title dinâmico `[Marca] [Modelo] [Ano] em [cidade] - [uf] | StockAuto`, alt-text automático com nome da revenda, rodapé "Buscas populares em Campo Grande" (4 links), texto de apoio em /veiculos, title/description do index.html.
- 06/2026 — **Seed Campo Grande - MS**: 2 revendedores (Bandeirantes Motors, MS Veículos Premium) + 6 anúncios ativos.
- 06/2026 — **Máscara de preço** R$ 0.000,00 no formulário de anúncio (CurrencyInput); vazio = "Consultar Valor".
- 06/2026 — Fluxo MVP ponta-a-ponta validado (cadastro → PIX/aprovação → anúncio com fotos drag-drop → moderação → publicação). Teste E2E 39/39 backend + 100% frontend.
- 06/2026 — **Identidade visual (logo)**: logo oficial StockAuto integrado — header (versão fundo claro, transparente), footer (versão fundo escuro) e favicons (ícone circular) em /app/frontend/public (favicon.ico, favicon-16/32/192/512, apple-touch-icon). Imagens processadas com PIL (fundo branco/preto → transparente). (1) `lang=pt-BR` no HTML (corrige tradução automática que gerava "Enfermeira") + lista de estados com nome completo (UF_STATES); (2) Busca avançada com filtros de Câmbio e Combustível (backend list_vehicles aceita transmission/fuel; migração `normalize_vehicle_choices` padroniza dados); (3) ícone "olhinho" de mostrar senha em Login e Cadastro; (4) Lightbox na galeria do anúncio (clique amplia + setas ‹ ›); (5) telefone + WhatsApp do vendedor em destaque no mobile (sticky bar); (6) Painel Admin: editar todos os dados do revendedor incluindo e-mail (login) e redefinir senha — backend AdminUserUpdateIn aceita email (com validação de unicidade) e password (re-hash bcrypt).

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
