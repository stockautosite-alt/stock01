export function brl(value) {
  if (value === null || value === undefined || value === "") return "Consultar valor";
  const n = Number(value);
  if (Number.isNaN(n)) return "Consultar valor";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export function km(value) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("pt-BR") + " km";
}

export function digits(s) {
  return (s || "").replace(/\D+/g, "");
}

export function waLink(whatsapp, message) {
  const num = digits(whatsapp);
  const url = `https://wa.me/${num}`;
  if (message) return `${url}?text=${encodeURIComponent(message)}`;
  return url;
}

export const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
];
