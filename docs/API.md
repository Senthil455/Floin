# API — 8 Routes (18 Datasets + FloodMap.net Bathtub)

| # | Route | Method | Body | Resp |
|---|---|---|---|---|
|1|`/api/datasets`|GET|—|`{status,totalDatasets:18,datasets[{id,name,category,format,featureCount,status}],summary{byCategory:{terrain:1,vector:2,rainfall:2,analysis:2,reference:11}}}`|
|2|`/api/location/query`|POST|`{aoi{center,bounds},requestId}`|`{requestId,aoi,timestamp,datasets[{covers,featureCount}],summary}` `ST_Intersects` if `DATABASE_URL` else `file` bounds check|
|3|`/api/location/features`|POST|`{aoi,datasets[],limit?,requestId}`|`{features:{id:{type:FeatureCollection,features,count,source:postgis/file}}}` limit 600|
|4|`/api/location/terrain`|GET|—|`{demFilePresent,demSource,rasters{dem,flow_direction,flow_accumulation,watershed,streams},postgisConfigured,note}`|
|4b|`/api/location/terrain`|POST|`{aoi}`|`{terrain{gridWidth,gridHeight,elevations[],min,max,resolution,source,provenance},statistics{min,max,range,mean,gridPoints}}` `geotiff` bilinear `Float32` cache 12-120 or `chennaiTopography` fallback|
|5|`/api/simulate`|POST|`{aoi,rainfall,cn,duration,requestId}`|`{hydrology{s,ia,q,runoff_mm},results{floodDepth,velocity,affectedBuildings,extent},timeSeries[7]} ` `blendedP=P*0.6+live*0.4` `tanh*exp`|
|5b|`/api/location/bathtub`|POST|`{aoi,floodLevel:number,includeSeaDepth?,palette?}`|`{floodLevel,statistics{flooded,total,pct,maxDepth,meanDepth},cells[≤600 {lng,lat,elev,depth}],source,provenance}` bathtub `elev < floodLevel` — FloodMap.net parity, ETOPO bathy|
|6|`/api/projects`|GET/POST|`{name,location}`|`{projects[],count}` / `{project{id,createdAt}}` file `projects.json` atomic `tmp→rename`|
|7|`/api/scenarios`|GET `?projectId`/POST|`{projectId,name,parameters,aoi}`|`{scenarios[]}` / `{scenario{id,createdAt}}` file `scenarios.json` `draft/running/completed`|

Validation: `xmin<xmax && ymin<ymax`, `P 0-400`, `CN 30-98`. `AbortSignal` respected. `MAX_CACHE 20` LRU key `id-xmin/xmax/ymin/ymax-P-CN-t-viewMode` + `requestId+AbortController` race-safe.

`curl`:
```bash
curl http://localhost:3000/api/datasets
curl -X POST http://localhost:3000/api/location/terrain -H "Content-Type: application/json" -d '{"aoi":{"bounds":{"xmin":80.24,"xmax":80.28,"ymin":13.05,"ymax":13.09}}}'
curl -X POST http://localhost:3000/api/location/bathtub -H "Content-Type: application/json" -d '{"aoi":{"bounds":{"xmin":80.24,"xmax":80.28,"ymin":13.05,"ymax":13.09}},"floodLevel":6.5,"includeSeaDepth":false}'
curl -X POST http://localhost:3000/api/simulate -H "Content-Type: application/json" -d '{"aoi":{"center":[80.27,13.08],"bounds":{"xmin":80.24,"xmax":80.30,"ymin":13.05,"ymax":13.11}},"rainfall":160,"cn":84,"duration":60}'
```
