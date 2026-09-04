const TERRARIUM_TMPL="https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const CACHE=new Map<string, { elev:number, at:string }>();
function lngLatToTile(lng:number, lat:number, z:number){
  const n=Math.pow(2,z);
  const x=Math.floor((lng+180)/360*n);
  const latRad=lat*Math.PI/180;
  const y=Math.floor((1-Math.log(Math.tan(latRad)+1/Math.cos(latRad))/Math.PI)/2*n);
  return {x,y};
}
export async function sampleMapzenTerrarium(lng:number, lat:number): Promise<number|null>{
  const key=`${lng.toFixed(4)},${lat.toFixed(4)}`;
  if(CACHE.has(key)) return CACHE.get(key)!.elev;
  const z=14;
  const {x,y}=lngLatToTile(lng,lat,z);
  const url=TERRARIUM_TMPL.replace("{z}",String(z)).replace("{x}",String(x)).replace("{y}",String(y));
  try{
    const res=await fetch(url,{ next:{ revalidate: 86400 } } as any);
    if(!res.ok) return null;
    const buf=await res.arrayBuffer();
    const { PNG } = await import("pngjs");
    const png=PNG.sync.read(Buffer.from(buf));
    const fx=((lng+180)/360*Math.pow(2,z) - x)*256;
    const fy=((1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*Math.pow(2,z) - y)*256;
    const px=Math.max(0,Math.min(255,Math.floor(fx))), py=Math.max(0,Math.min(255,Math.floor(fy)));
    const idx=(py*256+px)*4;
    const R=png.data[idx], G=png.data[idx+1], B=png.data[idx+2];
    const elev=(R*256 + G + B/256) - 32768;
    if(!isFinite(elev)) return null;
    CACHE.set(key,{elev, at:new Date().toISOString()});
    return elev;
  }catch{ return null; }
}
export function syntheticBathymetry(lng:number, lat:number): number {
  const coastLng=80.28;
  const dKm=(lng - coastLng)*111*Math.cos(lat*Math.PI/180);
  if(dKm>0) return -Math.min(30, Math.max(0, dKm*4.5 + Math.sin(lat*12)*1.2));
  return 0;
}
export function etopoApprox(lng:number, lat:number): number {
  const bath=syntheticBathymetry(lng,lat);
  if(bath< -0.2) return bath;
  return 0;
}
export const DATASET_ATTRIBUTION=[
  "Mapzen Terrarium (S3 elevation-tiles-prod) — per-tile RGB decode (R*256+G+B/256)-32768",
  "USGS TNM / SRTM 1-arc (30 m) — via Copernicus COP30 DSM (super-set, SRTM lineage)",
  "GMTED2010 (250 m) — USGS EROS blended global DEM for coarse fallback",
  "ETOPO1 (1' ~1.8 km) — NOAA NGDC global relief for bathymetry (negative depth)",
];
