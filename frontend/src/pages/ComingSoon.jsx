import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function ComingSoon({ title = "Em breve" }) {
  return (
    <div data-testid="coming-soon" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
      <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">StockAuto</div>
      <h1 className="mt-3 text-5xl md:text-6xl font-black tracking-tighter"
          style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}>
        {title}
      </h1>
      <p className="mt-6 text-zinc-600 max-w-xl leading-relaxed">
        Esta seção está em desenvolvimento. Em breve você poderá utilizá-la por completo.
      </p>
      <Link
        to="/"
        className="mt-10 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-tight border-b-2 border-black pb-1 hover:text-[#FF3B30] hover:border-[#FF3B30]"
      >
        <ArrowLeft size={16} /> Voltar para o início
      </Link>
    </div>
  );
}
