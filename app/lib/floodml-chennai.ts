export const CHENNAI_WARDS = [
  { id: "tondiarpet", name: "Tondiarpet", pop: 420000, basePrecip: 45, center: [80.286, 13.122] as [number, number] },
  { id: "anna_nagar", name: "Anna Nagar", pop: 560000, basePrecip: 78, center: [80.209, 13.085] as [number, number] },
  { id: "adyar", name: "Adyar", pop: 380000, basePrecip: 112, center: [80.257, 13.006] as [number, number] },
  { id: "velachery", name: "Velachery", pop: 310000, basePrecip: 145, center: [80.22, 12.975] as [number, number] },
  { id: "saidapet", name: "Saidapet", pop: 290000, basePrecip: 98, center: [80.224, 13.02] as [number, number] },
  { id: "ennore", name: "Ennore", pop: 180000, basePrecip: 67, center: [80.32, 13.214] as [number, number] },
  { id: "perungudi", name: "Perungudi", pop: 220000, basePrecip: 134, center: [80.24, 12.961] as [number, number] },
  { id: "thurai", name: "Thuraipakkam", pop: 200000, basePrecip: 89, center: [80.248, 12.942] as [number, number] },
];
export function wardFloodProb(precip: number, cn: number) {
  const S = 25400 / cn - 254; const Ia = 0.2 * S; const Q = precip <= Ia ? 0 : (precip - Ia) ** 2 / (precip + 0.8 * S);
  return Math.min(1, Q / 80);
}
export function wardDamage(ward: typeof CHENNAI_WARDS[0], rainfall: number, cn: number) {
  const p = (ward.basePrecip + rainfall) / 2;
  const prob = wardFloodProb(p, cn);
  const dmg = prob * ward.pop * 0.004 * (1 + p / 200);
  return { prob, dmg, p };
}
export function wardForLngLat(lng: number, lat: number) {
  let best = CHENNAI_WARDS[0], dist = Infinity;
  for (const w of CHENNAI_WARDS) { const d = Math.hypot((w.center[0] - lng) * 111, (w.center[1] - lat) * 111); if (d < dist) { dist = d; best = w; } }
  return best;
}
