export const runtime = 'nodejs';
import { NextRequest, NextResponse } from "next/server";
import { unifiedPredict } from "@/app/lib/unified-prediction";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { aoi, rainfall, cn, duration, livePrecip } = body as { aoi: any; rainfall: number; cn: number; duration: number; livePrecip?: number };
    if (!aoi || !aoi.bounds) return NextResponse.json({ error: "Invalid AOI" }, { status: 400 });
    if (rainfall < 0 || rainfall > 500) return NextResponse.json({ error: "rainfall 0-500" }, { status: 400 });
    if (cn < 30 || cn > 98) return NextResponse.json({ error: "CN 30-98" }, { status: 400 });
    const result = await unifiedPredict(aoi, rainfall, cn, duration, livePrecip || 0);
    return NextResponse.json({ status: "success", timestamp: new Date().toISOString(), ...result });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
export async function GET() {
  return NextResponse.json({ status: "ok", usage: "POST {aoi:{bounds:{xmin,xmax,ymin,ymax},center}, rainfall, cn, duration, livePrecip} → unified prediction with per-dataset contributions (every file contributes)", datasets: 310, engine: "unified-prediction: SCS + DEM + soil/LULC/drainage + tide/GW/subsidence + exposure + hazard + live" });
}
