import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Check, RefreshCw, LogOut } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { brl } from "@/lib/format";
import { AUTH } from "@/constants/testIds";

export default function PendingApproval() {
  const { user, refresh, logout } = useAuth();
  const [settings, setSettings] = useState(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api.get("/settings/public").then(({ data }) => setSettings(data)).catch(() => {});
  }, []);

  const pixKey = settings?.pix_key || "—";
  const holder = settings?.pix_holder_name || "—";
  const planPrice = user?.plan_price;
  const planName = user?.plan_name || user?.plan_code || "—";

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const onCheck = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  return (
    <div data-testid={AUTH.pixScreen} className="min-h-[calc(100vh-4rem)] bg-zinc-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">
          Conta criada — aguardando aprovação
        </div>
        <h1
          className="mt-3 font-black tracking-tighter leading-[0.95] text-4xl sm:text-5xl"
          style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
        >
          Pague o seu plano via <span className="text-[#FF3B30]">PIX</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-600 leading-relaxed">
          Olá <span className="font-bold">{user?.store_name}</span>, sua conta foi criada com
          sucesso. Para ativar o plano <span className="font-bold">{planName}</span> e começar
          a anunciar, faça o pagamento via PIX abaixo. Após confirmação, o admin libera seu
          painel.
        </p>

        <div className="mt-10 grid md:grid-cols-2 gap-6">
          {/* QR + Pix info */}
          <div className="bg-white border border-zinc-200 p-8">
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">QR Code PIX</div>
            <div className="mt-6 flex items-center justify-center p-6 bg-zinc-50 border border-zinc-100">
              {pixKey && pixKey !== "—" ? (
                <QRCodeCanvas
                  value={pixKey}
                  size={220}
                  bgColor="#fafafa"
                  fgColor="#000000"
                  level="M"
                  includeMargin={false}
                />
              ) : (
                <div className="h-[220px] w-[220px] grid place-items-center text-zinc-400 text-sm">
                  Configurando…
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="text-xs uppercase tracking-widest font-bold text-zinc-700">Chave PIX</div>
              <div className="mt-2 flex items-center gap-2 border border-zinc-300 h-12 px-4">
                <code data-testid={AUTH.pixKey} className="text-sm font-mono flex-1 truncate">{pixKey}</code>
                <button
                  data-testid={AUTH.pixCopy}
                  onClick={onCopy}
                  className="text-xs font-bold uppercase tracking-tight inline-flex items-center gap-1 hover:text-[#FF3B30]"
                >
                  {copied ? (<><Check size={14} /> Copiado</>) : (<><Copy size={14} /> Copiar</>)}
                </button>
              </div>
              <div className="mt-3 text-xs text-zinc-500">
                Titular: <span className="font-bold text-zinc-800">{holder}</span>
              </div>
            </div>
          </div>

          {/* Status + Plan */}
          <div className="bg-white border border-zinc-200 p-8 flex flex-col">
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">Status do plano</div>
            <div
              className="mt-4 text-3xl font-black tracking-tighter"
              style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
            >
              Plano {planName}
            </div>
            <div className="mt-1 text-zinc-600">
              Valor: <span className="font-bold text-black">{brl(planPrice)}</span>
            </div>
            <div className="mt-1 text-zinc-600">
              Limite: <span className="font-bold text-black">{user?.plan_ad_limit} anúncio(s)</span>
            </div>

            <div className="mt-6 border-l-4 border-amber-400 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
              <div className="font-bold uppercase tracking-wide text-xs">Aguardando aprovação</div>
              <p className="mt-1">
                Assim que o pagamento for confirmado, o ADM Master ativa sua conta. Você
                receberá acesso completo ao painel para criar seus anúncios.
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                data-testid={AUTH.pixGoPainel}
                onClick={onCheck}
                disabled={checking}
                className="flex-1 bg-black hover:bg-zinc-800 text-white h-12 font-bold uppercase tracking-tight inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
                {checking ? "Verificando…" : "Atualizar status"}
              </button>
              <button
                onClick={logout}
                className="flex-1 border border-zinc-300 hover:border-black h-12 font-bold uppercase tracking-tight inline-flex items-center justify-center gap-2"
              >
                <LogOut size={16} /> Sair
              </button>
            </div>

            <div className="mt-6 text-xs text-zinc-500 leading-relaxed">
              <span className="font-bold">Como pagar:</span> abra o app do seu banco, escolha
              <span className="font-bold"> PIX</span>, depois <span className="font-bold">Pix Copia e Cola</span> ou
              <span className="font-bold"> Ler QR Code</span> e cole/aponte para a chave acima.
              Informe o valor exato do plano e envie. Pronto.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
