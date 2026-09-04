# API — 7 Routes

| # | Route | Method | Body | Resp |
|---|---|---|---|---|
|1|`/api/datasets`|GET|—|`{status,totalDatasets:13,datasets[{id,name,category,format,featureCount,status}],summary{byCategory}}`|
|2|`/api/location/query`|POST|`{aoi{center,bounds},requestId}`|`{requestId,aoi,timestamp,datasets[{covers,featureCount}],summary}` `ST_Intersects` or `file`|
|3|`/api/location/features`|POST|`{aoi,datasets[],limit?,requestId}`|`{features:{id:{type:FeatureCollection,features,count,source}}}`|
|4|`/api/location/terrain`|GET|—|`{demFilePresent,demSource,rasters{dem...},postgisConfigured,note}`|
|4b|`/api/location/terrain`|POST|`{aoi}`|`{terrain{gridWidth,gridHeight,elevations[],min,max,resolution,source,provenance},statistics{min,max,range,mean,gridPoints}}` bilinear `12-120`|
|5|`/api/simulate`|POST|`{aoi,rainfall,cn,duration,requestId}`|`{hydrology{s,ia,q,runoff_mm},results{floodDepth,velocity,affectedBuildings,extent},timeSeries[7]} ` blendedP|
|6|`/api/projects`|GET/POST|`{name,location}`|`{projects[],count}` / `{project{id,createdAt}}` file `projects.json`|
|7|`/api/scenarios`|GET `?projectId`/POST|`{projectId,name,parameters,aoi}`|`{scenarios[]}` / `{scenario{id,createdAt}}` file `scenarios.json`|

Validation: `xmin<xmax && ymin<ymax`, `P 0-400`, `CN 30-98`. `AbortSignal` respected. `MAX_CACHE 20` LRU.

`curl`:
```bash
curl http://localhost:3000/api/datasets
curl -X POST http://localhost:3000/api/location/terrain -H "Content-Type: application/json" -d '{"aoi":{"bounds":{"xmin":80.24,"xmax":80.28,"ymin":13.05,"ymax":13.09}}}'
curl -X POST http://localhost:3000/api/simulate -H "Content-Type: application/json" -d '{"aoi":{"center":[80.27,13.08],"bounds":{"xmin":80.24,"xmax":80.30,"ymin":13.05,"ymax":13.11}},"rainfall":160,"cn":84,"duration":60}'
```
