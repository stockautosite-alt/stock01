import { Link } from "react-router-dom";
import { brl, km } from "@/lib/format";
import { fileUrl } from "@/lib/api";
import { MapPin } from "lucide-react";

export default function VehicleCard({ v, testIdBuilder }) {
  const photo = v.main_photo || (v.photos && v.photos[0]);
  const img = fileUrl(photo);
  return (
    <Link
      to={`/veiculo/${v.slug || v.id}`}
      data-testid={testIdBuilder ? testIdBuilder(v.id) : undefined}
      className="group flex flex-col border border-zinc-200 bg-white hover:-translate-y-1 hover:shadow-[0_10px_40px_rgb(0,0,0,0.12)] transition-all duration-300"
    >
      <div className="aspect-[4/3] overflow-hidden bg-zinc-100 relative">
        {img ? (
          <img
            src={img}
            alt={`${v.brand} ${v.model} ${v.year_model} em ${v.city} - ${v.uf}${v.dealer?.store_name ? ` - Revenda ${v.dealer.store_name}` : ""}`}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">sem foto</div>
        )}
        <div className="absolute top-3 left-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1">
          {v.category}
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          {v.brand} • {v.year_made}/{v.year_model}
        </div>
        <h3 className="mt-1 font-bold text-lg leading-tight tracking-tight" style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}>
          {v.model} {v.version ? <span className="font-medium text-zinc-600">{v.version}</span> : null}
        </h3>
        <div className="mt-2 text-sm text-zinc-600 flex items-center gap-3">
          <span>{km(v.km)}</span>
          <span className="flex items-center gap-1"><MapPin size={14}/> {v.city}/{v.uf}</span>
        </div>
        <div className="mt-auto pt-5">
          <div className={`text-xl font-black tracking-tight ${v.price ? "text-black" : "text-zinc-400"}`} style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}>
            {brl(v.price)}
          </div>
        </div>
      </div>
    </Link>
  );
}
