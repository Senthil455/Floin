import { NextRequest, NextResponse } from 'next/server';
import { fileFallbackQuery, tryPostGISQuery } from '@/app/lib/postgis';
interface AOI { bounds: { xmin: number; xmax: number; ymin: number; ymax: number }; }
const TABLE_MAP: Record<string,string>={ buildings:"buildings", highway:"highway", waterway:"waterway", natural_water:"natural_water", chennai2015_hotspots:"chennai2015_hotspots", rainfall_stations:"rainfall_stations" };
export async function POST(request: NextRequest): Promise<NextResponse> {
  try{
    const body=await request.json(); const { aoi, datasets, limit=500 }=body;
    if(!aoi||!aoi.bounds||!datasets) return NextResponse.json({ error:'Invalid request format' },{ status:400 });
    const results: Record<string,any>={};
    for(const datasetId of datasets){
      try{
        const table=TABLE_MAP[datasetId];
        if(table && process.env.DATABASE_URL){
          const sql=`SELECT ST_AsGeoJSON(geom)::json as geometry, row_to_json(t) - 'geom' as props FROM ${table} t WHERE ST_Intersects(geom, ST_MakeEnvelope($1,$2,$3,$4,4326)) LIMIT ${Math.min(600, Number(limit)||500)}`;
          const rows=await tryPostGISQuery(sql,[aoi.bounds.xmin, aoi.bounds.ymin, aoi.bounds.xmax, aoi.bounds.ymax]);
          if(rows){
            const features=rows.map((r:any)=>({ type:"Feature", geometry:r.geometry, properties:r.props }));
            results[datasetId]={ type:'FeatureCollection', features, count:features.length, source:'postgis' }; continue;
          }
        }
        const fb=fileFallbackQuery(aoi, datasetId, limit);
        results[datasetId]={ type:'FeatureCollection', features:fb.features, count:fb.count, source:'file' };
      }catch(error){ results[datasetId]={ type:'FeatureCollection', features:[], count:0, error: error instanceof Error?error.message:'Unknown error' }; }
    }
    return NextResponse.json({ requestId: body.requestId||`feat-${Date.now()}`, aoi, timestamp:new Date().toISOString(), features: results });
  }catch(error){ return NextResponse.json({ error: error instanceof Error?error.message:'Unknown error' },{ status:500 }); }
}
