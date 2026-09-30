# DATA AUDIT — What is real, what is stub

> Historical record generated `2026-09-28T00:06:27` by `python scripts/audit_data.py`.
> Local-only caches referenced below (`data/raw/`, `data/rasters/*.tif`, `data/processed/*` generated) were removed `2026-09-30` per `.gitignore`. This file is preserved as the audit record; re-run `audit_data.py` after re-fetching to regenerate. `data/processed/AUDIT.json` was also cleaned.

## Verdict counts

| Verdict | Meaning | Files |
|---|---|---|
| `SYNTHETIC_BOX` | axis-aligned rectangle placeholder | 144 |
| `POINT_ONLY` | point placeholder, no areal detail | 100 |
| `STUB_LINE` | line with <25 vertices (schematic) | 47 |
| `REAL_DETAILED` | irregular real geometry (many vertices) | 25 |
| `MIXED` | some real + some rectangle stubs | 8 |

**Real/usable:** `33/324` - **Stub/placeholder:** `291` - **Real observed vertices:** `4,599,735`

## High-value datasets (>40 KB = genuine payload)

| File | KB | Features | Vertices | Geometry | Observed GT |
|---|---|---|---|---|---|
| `chennai_flood_hazard_zones_map_7f29da20.geojson` | 27608.9 | 7453 | 1256389 | Polygon:4774,MultiPolygon:2548,GeometryCollection:131 | yes |
| `fl20151123ind_shp_s1_20151112_flood.geojson` | 10577.9 | 3974 | 475240 | Polygon:3974 | yes |
| `fl20151123ind_shp_s1_20151124_flood.geojson` | 6902.5 | 3104 | 307195 | Polygon:3101,MultiPolygon:3 | yes |
| `chennai_flows_200_years_return_period_61f1f06f.geojson` | 6454.1 | 383 | 301565 | Polygon:327,MultiPolygon:12,GeometryCollection:44 | yes |
| `chennai_flows_50_years_return_period_a6b20b7c.geojson` | 6156.4 | 491 | 287531 | Polygon:464,MultiPolygon:19,GeometryCollection:8 | yes |
| `fl20151123ind_shp_s1_20150901_preflood.geojson` | 5930.4 | 1150 | 272240 | Polygon:1150 | yes |
| `chennai_flows_25_year_return_period_a6b4f2b1.geojson` | 5910.8 | 549 | 275692 | Polygon:513,GeometryCollection:19,MultiPolygon:17 | yes |
| `chennai_flows_100_years_return_period_994a99a1.geojson` | 5648.6 | 422 | 263866 | Polygon:396,MultiPolygon:20,GeometryCollection:6 | yes |
| `chennai_flows_10_years_return_period_1bfef958.geojson` | 5247.1 | 678 | 243783 | Polygon:614,GeometryCollection:41,MultiPolygon:23 | yes |
| `chennai_flows_5_year_return_period_ef3286de.geojson` | 4364.1 | 579 | 202618 | Polygon:508,GeometryCollection:43,MultiPolygon:28 | yes |
| `chennai_storm_water_drains_swd_map_2023_c4907fed.geojson` | 3738.0 | 10256 | 118758 | LineString:10240,MultiLineString:16 | yes |
| `chennai2015_inundation.geojson` | 3447.5 | 4001 | 85519 | Polygon:4001 | yes |
| `buildings.geojson` | 2761.0 | 1811 | 22051 | MultiPolygon:1811 | yes |
| `chennai_waterbodies_map_2019_8d557090.geojson` | 2706.7 | 481 | 122410 | GeometryCollection:481 | yes |
| `chennai2015_flooded_streets.geojson` | 2517.8 | 7894 | 34683 | LineString:7894 | yes |
| `chennai_slum_boundaries_map_5959f0f4.geojson` | 2441.7 | 887 | 107936 | GeometryCollection:887 | yes |
| `chennai_flood_hazard_zones_gcc.geojson` | 1647.2 | 400 | 62252 | Polygon:400 |  |
| `fl20151123ind_shp_ls8_20151014_preflood.geojson` | 1132.4 | 562 | 50037 | Polygon:562 | yes |
| `sewerage_command_area_b186696c.geojson` | 725.5 | 365 | 31309 | GeometryCollection:365 | yes |
| `natural_water.geojson` | 596.8 | 555 | 15125 | MultiPolygon:555 | yes |
| `chennai_wards_200.geojson` | 593.9 | 201 | 12971 | Polygon:201 | yes |
| `chennai2015_crowd.geojson` | 433.9 | 1000 | 4408 | LineString:1000 | yes |
| `chennai_rivers_map_c6393f3d.geojson` | 379.2 | 2 | 17802 | GeometryCollection:2 | yes |
| `chennai_gcc_flood_extent_2005_c49407c8.geojson` | 316.0 | 196 | 13112 | GeometryCollection:196 | yes |
| `chennai_basin_rivers_and_streams_map_9434de03.geojson` | 178.9 | 83 | 7996 | LineString:79,MultiLineString:4 | yes |
| `sewage_ventilating_columns_5d31106a.geojson` | 152.2 | 1576 | 1576 | Point:1576 |  |
| `chennai2015_hotspots.geojson` | 138.0 | 327 | 327 | Point:327 | yes |
| `chennai_flooding_points_in_2015_93d2905a.geojson` | 92.5 | 753 | 753 | Point:753 |  |
| `chennai2015_stagnation.geojson` | 92.4 | 753 | 753 | Point:753 | yes |
| `chennai_slums_map_02144a0c.geojson` | 85.6 | 886 | 886 | Point:886 |  |
| `chennai_neighbourhood_parks_map_81043b6d.geojson` | 77.5 | 544 | 544 | Point:544 |  |
| `chennai_basin_micro_drains_map_4d6437e5.geojson` | 74.2 | 37 | 3297 | LineString:35,MultiLineString:2 | yes |
| `chennai_basin_macro_drains_map_80b07b87.geojson` | 46.2 | 15 | 2090 | LineString:15 | yes |

## Rasters

| File | KB |
|---|---|
| `data\rasters\Flow_Accumulation.tif` | 3371.7 |
| `data\rasters\Flow_Direction.tif` | 735.3 |
| `data\rasters\rasters_COP30\DEM.tif` | 5802.4 |
| `data\rasters\Streams.tif` | 954.0 |
| `data\rasters\Watershed.tif` | 1195.9 |
| `data\raw\dem\COP30_N12E080_30m.tif` | 6968.4 |
| `data\raw\dem\COP30_N13E080_30m.tif` | 12073.0 |
| `data\raw\lulc\ESA_WorldCover_10m_2021_v200_N12E078.tif` | 116275.2 |

## Stub inventory (safe to replace with real downloads)

| File | KB | Features | Declared name |
|---|---|---|---|
| `alos_palsar_chennai.geojson` | 1.2 | 2 | - |
| `chennai2015_hotspots.geojson` | 138.0 | 327 | chennai2015_hotspots |
| `chennai2015_stagnation.geojson` | 92.4 | 753 | stagnation |
| `chennai_agriculture_losses.geojson` | 1.8 | 3 | - |
| `chennai_air_quality.geojson` | 2.0 | 6 | - |
| `chennai_ambulance_flood_routes.geojson` | 0.8 | 3 | - |
| `chennai_anganwadis.geojson` | 1.0 | 4 | - |
| `chennai_arcgis_dashboard.geojson` | 1.3 | 2 | - |
| `chennai_banks_atms.geojson` | 1.0 | 4 | - |
| `chennai_bathymetry_adayar.geojson` | 1.7 | 3 | - |
| `chennai_beaches.geojson` | 1.3 | 4 | - |
| `chennai_borewells.geojson` | 1.0 | 4 | - |
| `chennai_bridges.geojson` | 1.3 | 4 | - |
| `chennai_building_flooddepth_2015.geojson` | 1.8 | 3 | - |
| `chennai_building_heights_lidar.geojson` | 2.2 | 6 | - |
| `chennai_bus_depots.geojson` | 2.2 | 6 | - |
| `chennai_bus_stops.geojson` | 1.0 | 4 | - |
| `chennai_canal_water_levels.geojson` | 1.8 | 3 | - |
| `chennai_canals_detailed.geojson` | 1.3 | 4 | - |
| `chennai_catchment_response.geojson` | 1.8 | 3 | - |
| `chennai_churches.geojson` | 1.0 | 4 | - |
| `chennai_coast_guard.geojson` | 1.0 | 4 | - |
| `chennai_colleges.geojson` | 1.0 | 4 | - |
| `chennai_community_halls.geojson` | 1.1 | 4 | - |
| `chennai_compost_yards.geojson` | 2.3 | 4 | - |
| `chennai_contours_1m.geojson` | 3.8 | 8 | - |
| `chennai_culverts.geojson` | 1.0 | 4 | - |
| `chennai_custom_ward_rainfall_cyclone.geojson` | 1.2 | 2 | - |
| `chennai_cyclone_shelters.geojson` | 1.1 | 4 | - |
| `chennai_cyclone_tracks.geojson` | 1.2 | 2 | - |
| `chennai_drainage.geojson` | 1.4 | 5 | Chennai Stormwater Drainage — GCC + OSM Overpass |
| `chennai_drone_adyar_dsm_10cm.geojson` | 1.1 | 2 | - |
| `chennai_drone_survey_2023.geojson` | 1.7 | 3 | - |
| `chennai_economic_assets.geojson` | 1.1 | 4 | - |
| `chennai_economic_losses_2015.geojson` | 1.8 | 3 | - |
| `chennai_election_wards_2024.geojson` | 2.3 | 4 | - |
| `chennai_electric_feeders.geojson` | 1.3 | 4 | - |
| `chennai_evac_shelter_capacities_detail.geojson` | 0.9 | 3 | - |
| `chennai_evac_time_model.geojson` | 1.7 | 3 | - |
| `chennai_evacuation_routes.geojson` | 3.1 | 6 | - |
| `chennai_extra_001.geojson` | 1.7 | 3 | - |
| `chennai_extra_002.geojson` | 1.0 | 3 | - |
| `chennai_extra_003.geojson` | 0.8 | 3 | - |
| `chennai_extra_004.geojson` | 1.7 | 3 | - |
| `chennai_extra_005.geojson` | 1.0 | 3 | - |
| `chennai_extra_006.geojson` | 0.8 | 3 | - |
| `chennai_extra_007.geojson` | 1.7 | 3 | - |
| `chennai_extra_008.geojson` | 1.0 | 3 | - |
| `chennai_extra_009.geojson` | 0.8 | 3 | - |
| `chennai_extra_010.geojson` | 1.7 | 3 | - |
| `chennai_extra_011.geojson` | 1.0 | 3 | - |
| `chennai_extra_012.geojson` | 0.8 | 3 | - |
| `chennai_extra_013.geojson` | 1.7 | 3 | - |
| `chennai_extra_014.geojson` | 1.0 | 3 | - |
| `chennai_extra_015.geojson` | 0.8 | 3 | - |
| `chennai_extra_016.geojson` | 1.7 | 3 | - |
| `chennai_extra_017.geojson` | 1.0 | 3 | - |
| `chennai_extra_018.geojson` | 0.8 | 3 | - |
| `chennai_extra_019.geojson` | 1.7 | 3 | - |
| `chennai_extra_020.geojson` | 1.0 | 3 | - |
| `chennai_extra_021.geojson` | 0.8 | 3 | - |
| `chennai_extra_022.geojson` | 1.7 | 3 | - |
| `chennai_extra_023.geojson` | 1.0 | 3 | - |
| `chennai_extra_024.geojson` | 0.8 | 3 | - |
| `chennai_extra_025.geojson` | 1.7 | 3 | - |
| `chennai_extra_026.geojson` | 1.0 | 3 | - |
| `chennai_extra_027.geojson` | 0.8 | 3 | - |
| `chennai_extra_028.geojson` | 1.7 | 3 | - |
| `chennai_extra_029.geojson` | 1.0 | 3 | - |
| `chennai_extra_030.geojson` | 0.8 | 3 | - |
| `chennai_extra_031.geojson` | 1.7 | 3 | - |
| `chennai_extra_032.geojson` | 1.0 | 3 | - |
| `chennai_extra_033.geojson` | 0.8 | 3 | - |
| `chennai_extra_034.geojson` | 1.7 | 3 | - |
| `chennai_extra_035.geojson` | 1.0 | 3 | - |
| `chennai_extra_036.geojson` | 0.8 | 3 | - |
| `chennai_extra_037.geojson` | 1.7 | 3 | - |
| `chennai_extra_038.geojson` | 1.0 | 3 | - |
| `chennai_extra_039.geojson` | 0.8 | 3 | - |
| `chennai_extra_040.geojson` | 1.7 | 3 | - |
| `chennai_extra_041.geojson` | 1.0 | 3 | - |
| `chennai_extra_042.geojson` | 0.8 | 3 | - |
| `chennai_extra_043.geojson` | 1.7 | 3 | - |
| `chennai_extra_044.geojson` | 1.0 | 3 | - |
| `chennai_extra_045.geojson` | 0.8 | 3 | - |
| `chennai_extra_046.geojson` | 1.7 | 3 | - |
| `chennai_extra_047.geojson` | 1.0 | 3 | - |
| `chennai_extra_048.geojson` | 0.8 | 3 | - |
| `chennai_extra_049.geojson` | 1.7 | 3 | - |
| `chennai_extra_050.geojson` | 1.0 | 3 | - |
| `chennai_fire_rescue_boat.geojson` | 0.8 | 3 | - |
| `chennai_fire_stations.geojson` | 1.1 | 4 | - |
| `chennai_fishing_harbors.geojson` | 1.1 | 4 | - |
| `chennai_flood_all_001.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_002.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_003.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_004.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_005.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_006.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_007.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_008.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_009.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_010.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_011.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_012.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_013.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_014.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_015.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_016.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_017.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_018.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_019.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_020.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_021.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_022.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_023.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_024.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_025.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_026.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_027.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_028.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_029.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_030.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_031.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_032.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_033.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_034.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_035.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_036.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_037.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_038.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_039.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_040.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_041.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_042.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_043.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_044.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_045.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_046.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_047.geojson` | 1.0 | 3 | - |
| `chennai_flood_all_048.geojson` | 0.8 | 3 | - |
| `chennai_flood_all_049.geojson` | 1.7 | 3 | - |
| `chennai_flood_all_050.geojson` | 1.0 | 3 | - |
| `chennai_flood_insurance_claims.geojson` | 1.8 | 3 | - |
| `chennai_flood_monitor_dss.geojson` | 1.2 | 2 | - |
| `chennai_flood_plain_adayar_cooum.geojson` | 1.2 | 2 | - |
| `chennai_flood_sensor_cscl.geojson` | 1.2 | 2 | - |
| `chennai_flood_vulnerability_abhi.geojson` | 1.2 | 2 | - |
| `chennai_flood_walls_bunds.geojson` | 1.3 | 4 | - |
| `chennai_flooding_points_in_2015_93d2905a.geojson` | 92.5 | 753 | - |
| `chennai_floodmapping_ml_shivani.geojson` | 1.2 | 2 | - |
| `chennai_floods_2005_extent.geojson` | 1.2 | 2 | - |
| `chennai_floods_2020_nivar.geojson` | 1.2 | 2 | - |
| `chennai_flow_100yr_return.geojson` | 1.3 | 2 | - |
| `chennai_flow_10yr_return.geojson` | 1.3 | 2 | - |
| `chennai_flow_200yr_return.geojson` | 1.3 | 2 | - |
| `chennai_flow_25yr_return.geojson` | 1.3 | 2 | - |
| `chennai_flow_50yr_return.geojson` | 1.3 | 2 | - |
| `chennai_flow_5yr_return.geojson` | 1.3 | 2 | - |
| `chennai_food_stock.geojson` | 1.7 | 3 | - |
| `chennai_gcc_flood_hostspots_2020_3a141c21.geojson` | 6.9 | 53 | - |
| `chennai_groundwater.geojson` | 2.0 | 6 | - |
| `chennai_gw_flood_interaction.geojson` | 1.8 | 3 | - |
| `chennai_gw_recharge_zones.geojson` | 2.3 | 4 | - |
| `chennai_health_infra_detailed.geojson` | 1.2 | 2 | - |
| `chennai_helpline_calls_2015.geojson` | 0.8 | 3 | - |
| `chennai_heritage.geojson` | 1.0 | 4 | - |
| `chennai_heritage_risk.geojson` | 1.7 | 3 | - |
| `chennai_highres_topo_2026.geojson` | 1.3 | 2 | - |
| `chennai_historical_floods_2016_2024.geojson` | 1.5 | 2 | - |
| `chennai_hospital_flood_exposure.geojson` | 0.8 | 3 | - |
| `chennai_hospitals_relief.geojson` | 4.6 | 12 | - |
| `chennai_household_survey.geojson` | 1.1 | 4 | - |
| `chennai_imd_aws_live.geojson` | 1.7 | 3 | - |
| `chennai_imd_forecast_grids.geojson` | 1.1 | 4 | - |
| `chennai_industrial_estates.geojson` | 2.3 | 4 | - |
| `chennai_industrial_losses.geojson` | 1.7 | 3 | - |
| `chennai_inundation_depth_inches.geojson` | 1.3 | 2 | - |
| `chennai_inundation_points_with_depth_of_inundation_814ca028.geojson` | 18.6 | 192 | - |
| `chennai_it_parks.geojson` | 2.3 | 4 | - |
| `chennai_itc_demographics_ward.geojson` | 1.1 | 2 | - |
| `chennai_lake_encroachments_48.geojson` | 1.1 | 2 | - |
| `chennai_lake_levels_32.geojson` | 1.7 | 3 | - |
| `chennai_land_parcels.geojson` | 2.3 | 4 | - |
| `chennai_land_subsidence.geojson` | 1.9 | 6 | - |
| `chennai_landfill_perungudi.geojson` | 2.3 | 4 | - |
| `chennai_lidar_nDSM_10cm.geojson` | 1.7 | 3 | - |
| `chennai_lost_waterbodies_2025.geojson` | 1.3 | 2 | - |
| `chennai_lulc.geojson` | 1.5 | 5 | Chennai LULC — Bhuvan 1:50k 2015-16 + NRSC |
| `chennai_mangroves.geojson` | 2.3 | 4 | - |
| `chennai_markets.geojson` | 1.0 | 4 | - |
| `chennai_medicine_stock.geojson` | 1.7 | 3 | - |
| `chennai_metro_rail.geojson` | 1.1 | 2 | - |
| `chennai_metro_water_tankers_live.geojson` | 1.1 | 2 | - |
| `chennai_mosques.geojson` | 1.0 | 4 | - |
| `chennai_neighbourhood_parks_map_81043b6d.geojson` | 77.5 | 544 | - |
| `chennai_news_flood_articles.geojson` | 1.8 | 3 | - |
| `chennai_ngo_resources.geojson` | 0.8 | 3 | - |
| `chennai_ngt_urban_floods_report_2021.geojson` | 1.3 | 2 | - |
| `chennai_parks_waterbodies.geojson` | 4.5 | 6 | - |
| `chennai_petrol_pumps.geojson` | 1.1 | 4 | - |
| `chennai_phcs.geojson` | 1.0 | 4 | - |
| `chennai_police_stations.geojson` | 1.1 | 4 | - |
| `chennai_population_exposure.geojson` | 1.8 | 3 | - |
| `chennai_population_grid_100m.geojson` | 2.7 | 8 | - |
| `chennai_power_grid_exposure.geojson` | 1.8 | 3 | - |
| `chennai_power_substations.geojson` | 2.4 | 6 | - |
| `chennai_property_tax_zones.geojson` | 2.3 | 4 | - |
| `chennai_public_amenities_smartcities.geojson` | 1.2 | 2 | - |
| `chennai_pump_logs_2023.geojson` | 1.7 | 3 | - |
| `chennai_pumping_stations.geojson` | 2.8 | 8 | - |
| `chennai_railway_stations.geojson` | 1.1 | 4 | - |
| `chennai_rainfall_radar_15min.geojson` | 1.8 | 3 | - |
| `chennai_reservoir_release_logs.geojson` | 1.8 | 3 | - |
| `chennai_river_cross_sections.geojson` | 2.6 | 6 | - |
| `chennai_river_gauge_adyar.geojson` | 0.8 | 3 | - |
| `chennai_river_gauge_cooum.geojson` | 0.8 | 3 | - |
| `chennai_river_gauge_kosasthalaiyar.geojson` | 0.8 | 3 | - |
| `chennai_road_closures_2015.geojson` | 2.8 | 6 | - |
| `chennai_road_flood_suscept.geojson` | 1.8 | 3 | - |
| `chennai_satellite_flood_timeline.geojson` | 1.8 | 3 | - |
| `chennai_school_flood_exposure.geojson` | 0.8 | 3 | - |
| `chennai_schools_shelters.geojson` | 3.2 | 8 | - |
| `chennai_sea_level_trend.geojson` | 1.7 | 3 | - |
| `chennai_sentinel1_flood_extent.geojson` | 0.7 | 1 | - |
| `chennai_sewage_network.geojson` | 2.8 | 6 | - |
| `chennai_sewage_outfalls.geojson` | 1.1 | 4 | - |
| `chennai_slum_flood_exposure.geojson` | 0.8 | 3 | - |
| `chennai_slums_locations.geojson` | 1.2 | 2 | - |
| `chennai_slums_map_02144a0c.geojson` | 85.6 | 886 | - |
| `chennai_slums_vulnerability.geojson` | 4.6 | 6 | - |
| `chennai_smartcities_roads.geojson` | 1.2 | 2 | - |
| `chennai_social_media_flood.geojson` | 1.8 | 3 | - |
| `chennai_soil.geojson` | 1.1 | 3 | Chennai Soil — NBSS 1:50k |
| `chennai_soil_infiltration.geojson` | 1.7 | 3 | - |
| `chennai_solid_waste_bins_8k.geojson` | 1.2 | 2 | - |
| `chennai_storm_surge_detailed.geojson` | 1.8 | 3 | - |
| `chennai_storm_surge_zones.geojson` | 2.3 | 4 | - |
| `chennai_stp_capacity_12.geojson` | 1.1 | 2 | - |
| `chennai_street_flood_sensors_iot.geojson` | 0.8 | 3 | - |
| `chennai_street_lights.geojson` | 1.1 | 4 | - |
| `chennai_swd_stormwater_drain.geojson` | 1.2 | 2 | - |
| `chennai_telecom_exposure.geojson` | 1.7 | 3 | - |
| `chennai_telecom_towers.geojson` | 1.1 | 4 | - |
| `chennai_temples.geojson` | 1.0 | 4 | - |
| `chennai_thiruppugazh_30yr_committee.geojson` | 1.4 | 2 | - |
| `chennai_tide_forecast.geojson` | 1.1 | 4 | - |
| `chennai_tide_gauge.geojson` | 0.8 | 2 | - |
| `chennai_tide_table_2024_25.geojson` | 1.8 | 3 | - |
| `chennai_traffic_flood_exposure.geojson` | 1.8 | 3 | - |
| `chennai_traffic_sensors.geojson` | 2.3 | 6 | - |
| `chennai_traffic_signals.geojson` | 1.1 | 4 | - |
| `chennai_tree_census_2023.geojson` | 1.2 | 2 | - |
| `chennai_uchcs_map_a604ea86.geojson` | 1.9 | 14 | - |
| `chennai_uphcs_map_a33b403b.geojson` | 18.1 | 140 | - |
| `chennai_urban_heat_flood.geojson` | 1.7 | 3 | - |
| `chennai_veterinary.geojson` | 1.0 | 4 | - |
| `chennai_volunteer_registry.geojson` | 0.8 | 3 | - |
| `chennai_vulnerability_ann_rf_2025.geojson` | 1.3 | 2 | - |
| `chennai_vulnerability_index_ward.geojson` | 1.8 | 3 | - |
| `chennai_ward_flooddepth_2015.geojson` | 1.8 | 3 | - |
| `chennai_waste_exposure.geojson` | 1.7 | 3 | - |
| `chennai_waste_transfer.geojson` | 1.1 | 4 | - |
| `chennai_waste_zones.geojson` | 2.3 | 4 | - |
| `chennai_water_census_map_2023_7e357cf5.geojson` | 29.2 | 303 | - |
| `chennai_water_supply_exposure.geojson` | 1.8 | 3 | - |
| `chennai_water_supply_zones.geojson` | 2.3 | 4 | - |
| `chennai_water_tanks.geojson` | 1.0 | 4 | - |
| `chennai_watershed_boundaries.geojson` | 1.5 | 2 | - |
| `chennai_wetlands.geojson` | 2.3 | 4 | - |
| `chennai_wrisharem_live_storage.geojson` | 1.1 | 2 | - |
| `cityfinance_chennai_budget.geojson` | 1.2 | 2 | - |
| `cwc_flood_forecast_chennai.geojson` | 1.1 | 2 | - |
| `gcc_budget_capital_2022_23.geojson` | 1.2 | 2 | - |
| `gcc_encroachment_south_chennai.geojson` | 1.2 | 2 | - |
| `gcc_flood_complaints_2023.geojson` | 1.2 | 2 | - |
| `google_open_buildings_chennai.geojson` | 1.2 | 2 | - |
| `iitm_cmip6_chennai_projections.geojson` | 1.1 | 2 | - |
| `imd_cyclone_warning_bob.geojson` | 1.1 | 2 | - |
| `imd_heavy_rainfall_warning.geojson` | 1.1 | 2 | - |
| `india_flood_inventory_1985_2016.geojson` | 1.3 | 2 | - |
| `india_flood_inventory_impacts_1967_2023.geojson` | 1.1 | 2 | - |
| `india_reservoir_live_wris.geojson` | 1.2 | 2 | - |
| `landsat_7_8_chennai.geojson` | 1.2 | 2 | - |
| `nrsc_bhuvan_lulc_change_2000_2022.geojson` | 1.1 | 2 | - |
| `osm_in_flood_map_live.geojson` | 1.2 | 2 | - |
| `rainfall_stations.geojson` | 2.2 | 8 | imd_rainfall_stations_chennai |
| `sewage_ventilating_columns_5d31106a.geojson` | 152.2 | 1576 | - |
| `smartcities_property_tax_chennai.geojson` | 1.2 | 2 | - |
| `tnsdma_flood_control_logs.geojson` | 1.1 | 2 | - |
| `water_consumption_capacity_zone.geojson` | 1.2 | 2 | - |
