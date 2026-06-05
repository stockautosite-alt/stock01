import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ChevronRight, LogOut } from "lucide-react";

/**
 * Shared editorial sidebar layout used by Dealer Panel and Admin Panel.
 *
 * Props:
 *  - title: string (e.g. "Painel do revendedor")
 *  - subtitle: optional kicker text
 *  - tabs: [{ key, label, icon }]
 *  - activeTab: key
 *  - onTabChange: (key) => void
 *  - statusBadge: optional ReactNode shown beside title
 *  - testIdPage: data-testid for the page container
 *  - rightHeader: optional ReactNode on the top-right (e.g. "New ad" button)
 */
export default function PanelLayout({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  statusBadge,
  testIdPage,
  rightHeader,
  children,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div data-testid={testIdPage} className="bg-zinc-50 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            {subtitle && (
              <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">
                {subtitle}
              </div>
            )}
            <div className="mt-2 flex items-center gap-4 flex-wrap">
              <h1
                className="text-4xl sm:text-5xl font-black tracking-tighter leading-[0.95]"
                style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
              >
                {title}
              </h1>
              {statusBadge}
            </div>
            {user && (
              <div className="mt-2 text-sm text-zinc-500">
                {user.email} · <button onClick={onLogout} className="inline-flex items-center gap-1 hover:text-black"><LogOut size={12}/> sair</button>
              </div>
            )}
          </div>
          {rightHeader && <div className="flex items-center gap-3">{rightHeader}</div>}
        </div>

        {/* Body */}
        <div className="mt-10 grid lg:grid-cols-12 gap-8">
          {/* Sidebar tabs */}
          <aside className="lg:col-span-3">
            <nav className="bg-white border border-zinc-200">
              {tabs.map((t) => {
                const active = t.key === activeTab;
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    data-testid={t.testId}
                    onClick={() => onTabChange(t.key)}
                    className={`group w-full text-left px-5 py-4 flex items-center gap-3 border-l-4 transition-all ${active ? "bg-black text-white border-[#FF3B30]" : "border-transparent hover:bg-zinc-50"}`}
                  >
                    {Icon && <Icon size={16} className={active ? "text-[#FF3B30]" : "text-zinc-400 group-hover:text-black"} />}
                    <span className="text-sm font-bold uppercase tracking-tight">{t.label}</span>
                    <ChevronRight size={14} className={`ml-auto ${active ? "text-[#FF3B30]" : "text-zinc-300"}`} />
                  </button>
                );
              })}
            </nav>
            <Link
              to="/"
              className="mt-3 inline-flex items-center gap-1 text-xs uppercase tracking-widest font-bold text-zinc-500 hover:text-black"
            >
              ← voltar ao site
            </Link>
          </aside>

          {/* Content */}
          <section className="lg:col-span-9">{children}</section>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    active: { label: "Conta ativa", cls: "bg-green-100 text-green-800 border-green-300" },
    pending: { label: "Aguardando aprovação", cls: "bg-amber-100 text-amber-800 border-amber-300" },
    blocked: { label: "Conta bloqueada", cls: "bg-red-100 text-red-800 border-red-300" },
  };
  const m = map[status] || { label: status || "—", cls: "bg-zinc-100 text-zinc-700 border-zinc-300" };
  return (
    <span className={`inline-flex items-center text-xs font-bold uppercase tracking-widest border px-3 py-1 ${m.cls}`}>
      {m.label}
    </span>
  );
}
