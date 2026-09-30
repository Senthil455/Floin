# FLOIN — prebuilt PostGIS image, published through GitHub Container Registry so the
# spatial database can be shared over GitHub without storing the database in git.
#
# Pull (no build, no local data needed):
#   docker pull ghcr.io/senthil455/floin-postgis:latest
#   docker run -d --name floin-postgis -e POSTGRES_PASSWORD=floin -p 5432:5432 \
#     ghcr.io/senthil455/floin-postgis:latest
#
# Build locally (includes whatever rasters you have in data/rasters — the TIFFs are
# gitignored, so a locally built image is the way to ship the raster layers):
#   docker build -f db/Dockerfile -t floin-postgis .
#
# The image is the docker-compose service with the data already baked in:
#   db/schema.sql      -> /docker-entrypoint-initdb.d/10-floin-schema.sql
#   db/bootstrap-load.sh -> /docker-entrypoint-initdb.d/20-floin-load.sh
# Both run once, on first boot, against the initialised cluster.

FROM postgis/postgis:16-3.4

LABEL org.opencontainers.image.title="floin-postgis" \
      org.opencontainers.image.description="FLOIN Chennai flood-intelligence PostGIS 16-3.4 with schema + GeoJSON/TIFF ingestion baked in" \
      org.opencontainers.image.source="https://github.com/Senthil455/Floin" \
      org.opencontainers.image.licenses="MIT"

# ogr2ogr comes from GDAL. raster2pgsql and psql already ship with postgis/postgis.
RUN apt-get update \
 && apt-get install -y --no-install-recommends gdal-bin \
 && rm -rf /var/lib/apt/lists/*

# 10- schema: idempotent DDL, shared contract for the Next.js API (`geom` column).
COPY db/schema.sql /docker-entrypoint-initdb.d/10-floin-schema.sql

# 20- data load: executed (chmod +x) so the entrypoint does not source it into its own shell.
COPY db/bootstrap-load.sh /docker-entrypoint-initdb.d/20-floin-load.sh
RUN chmod +x /docker-entrypoint-initdb.d/20-floin-load.sh

# Canonical inputs. data/vectors is tracked in git (~110 MB) so CI always has it;
# data/rasters only holds .gitkeep in a clean clone — add the TIFFs locally to bake
# the raster layers (dem, flow_*, watershed, streams) into a locally built image.
COPY data/vectors/ /opt/floin/data/vectors/
COPY data/rasters/ /opt/floin/data/rasters/

# Schema-only consumers can skip the data load: docker run -e FLOIN_SKIP_LOAD=1 ...
