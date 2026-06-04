import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { fileUrl } from "@/lib/api";
import VehicleCard from "@/components/VehicleCard";
import WhatsAppButton from "@/components/WhatsAppButton";
import { DEALER } from "@/constants/testIds";
import { MapPin, Phone, ArrowLeft, Building2 } from "lucide-react";
import { digits } from "@/lib/format";

export default function DealerProfile() {
  const { slug } = useParams();
  const [dealer, setDealer] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setDealer(null);
    setError(null);
    api
      .get(`/dealers/${slug}`)
      .then((r) => {
        setDealer(r.data);
        return api.get(`/vehicles`, { params: { dealer_slug: slug, limit: 60 } });
      })
      .then((r) => setVehicles(r?.data?.items || []))
      .catch((e) => setError(e?.response?.data?.detail || "Revendedor não encontrado."))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!dealer) return;
    document.title = `${dealer.store_name} - Revendedor em ${dealer.city}/${dealer.uf} | StockAuto`;
  }, [dealer]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-32">
        <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Ops</div>
        <h1 className="mt-3 text-5xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
          {error}
        </h1>
        <Link to="/revendedores" className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase border-b-2 border-black">
          <ArrowLeft size={16} /> Ver revendedores
        </Link>
      </div>
    );
  }

  if (loading || !dealer) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 animate-pulse">
        <div className="h-48 bg-zinc-100" />
        <div className="h-10 w-1/2 bg-zinc-100 mt-8" />
      </div>
    );
  }

  return (
    <div data-testid={DEALER.page}>
      {/* COVER */}
      <div data-testid={DEALER.cover} className="relative h-48 md:h-72 bg-black overflow-hidden">
        {dealer.cover_path ? (
          <img src={fileUrl(dealer.cover_path)} alt={`Capa ${dealer.store_name}`} className="w-full h-full object-cover opacity-80" />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, #FF3B30 0%, transparent 40%), radial-gradient(circle at 80% 70%, #1a1a1a 0%, transparent 50%)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>

      {/* HEADER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 md:-mt-20 relative">
        <div className="bg-white border border-zinc-200 p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-center shadow-[0_10px_40px_rgba(0,0,0,0.08)]">
          <div data-testid={DEALER.logo} className="w-24 h-24 md:w-28 md:h-28 bg-zinc-100 flex-shrink-0 overflow-hidden border border-zinc-200">
            {dealer.logo_path ? (
              <img src={fileUrl(dealer.logo_path)} alt={dealer.store_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400">
                <Building2 size={36} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Revendedor</div>
            <h1
              data-testid={DEALER.name}
              className="mt-2 text-3xl md:text-4xl font-black tracking-tighter leading-tight"
              style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
            >
              {dealer.store_name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
              {(dealer.city || dealer.uf) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} /> {dealer.city}/{dealer.uf}
                </span>
              )}
              {dealer.phone && (
                <a href={`tel:${digits(dealer.phone)}`} className="inline-flex items-center gap-1 hover:text-black">
                  <Phone size={14} /> {dealer.phone}
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {dealer.whatsapp && (
              <WhatsAppButton
                whatsapp={dealer.whatsapp}
                message={`Olá ${dealer.store_name}! Vim pelo StockAuto e tenho interesse no estoque de vocês.`}
                label="WhatsApp da loja"
                size="md"
                data-testid={DEALER.whatsapp}
              />
            )}
          </div>
        </div>

        {dealer.description && (
          <div className="mt-8 max-w-3xl">
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500 mb-3">Sobre a loja</div>
            <p className="text-zinc-700 leading-relaxed whitespace-pre-line">{dealer.description}</p>
          </div>
        )}

        {dealer.address && (
          <div className="mt-6 text-sm text-zinc-600 inline-flex items-center gap-2">
            <MapPin size={14} className="text-zinc-400" /> {dealer.address}
          </div>
        )}
      </div>

      {/* INVENTORY */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Estoque</div>
            <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              {vehicles.length} {vehicles.length === 1 ? "veículo" : "veículos"} disponíveis
            </h2>
          </div>
        </div>

        {vehicles.length === 0 ? (
          <div className="border border-dashed border-zinc-300 py-24 text-center text-zinc-500">
            Esta loja ainda não publicou anúncios.
          </div>
        ) : (
          <div data-testid={DEALER.inventoryGrid} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {vehicles.map((v) => (
              <VehicleCard key={v.id} v={v} testIdBuilder={DEALER.vehicleCard} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
