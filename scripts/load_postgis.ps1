param([switch]$DryRun)
$ROOT = Split-Path $PSScriptRoot -Parent
$DB = "host=localhost dbname=floin user=floin password=floin"
function Run($cmd){ Write-Host "`$ $cmd" -ForegroundColor Cyan; if($DryRun){return}; Invoke-Expression $cmd }

Write-Host "[Module 3] Store & Organize -> PostGIS" -ForegroundColor Green
if($DryRun){ Write-Host "[dry-run]" -ForegroundColor Yellow }

$vectors = @(
  @{table="buildings"; file="data/processed/vectors/buildings.geojson"},
  @{table="highway"; file="data/processed/vectors/highway.geojson"},
  @{table="natural_water"; file="data/processed/vectors/natural_water.geojson"},
  @{table="waterway"; file="data/processed/vectors/waterway.geojson"},
  @{table="rainfall_stations"; file="data/processed/vectors/rainfall_stations.geojson"}
)
foreach($v in $vectors){
  $src = Join-Path $ROOT $v.file
  if(!(Test-Path $src)){ $src = Join-Path $ROOT ("data/vectors/"+(Split-Path $v.file -Leaf)) }
  if(!(Test-Path $src)){ Write-Host "skip $($v.file)" -ForegroundColor DarkGray; continue }
  Run "ogr2ogr -f PostgreSQL PG:`"$DB`" `"$src`" -nln $($v.table) -overwrite -lco GEOMETRY_NAME=geom -lco FID=id"
}

$rasters = @("rasters_COP30/DEM.tif","Flow_Direction.tif","Flow_Accumulation.tif","Watershed.tif","Streams.tif")
foreach($r in $rasters){
  $src = Join-Path $ROOT "data/rasters/$r"
  if(!(Test-Path $src)){ $src = Join-Path $ROOT "data/$r" }
  if(!(Test-Path $src)){ Write-Host "skip $r" -ForegroundColor DarkGray; continue }
  $table = ([IO.Path]::GetFileNameWithoutExtension($r) -replace "[^a-z0-9]","_").ToLower()
  if($r -like "*DEM*"){ $table="dem" }
  Run "raster2pgsql -s 4326 -I -C -M -t 256x256 `"$src`" public.$table | psql `"$DB`""
}
Write-Host "Done. Verify: psql floin -c \d buildings" -ForegroundColor Green
