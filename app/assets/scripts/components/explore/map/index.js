import React, { useMemo, useContext, useEffect, useState } from 'react';
import styled from 'styled-components';
import SizeAwareElement from '../../common/size-aware-element';
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  ImageOverlay,
  Circle,
} from 'react-leaflet';
import L from 'leaflet';
import GlobalContext from '../../../context/global';
import { ExploreContext, useMapState } from '../../../context/explore';
import { useMapRef, useMapLayers, useUserLayers } from '../../../context/map';

import GeoCoder from '../../common/map/geocoder';
import { BOUNDS_PADDING } from '../../common/map/constants';
import CenterMap from '../../common/map/center-map';

import { themeVal, multiply } from '@devseed-ui/theme-provider';
import theme from '../../../styles/theme';
import AoiDrawControl from './aoi-draw-control';
import AoiEditControl from './aoi-edit-control';
import PolygonDrawControl from './polygon-draw-control';
import config from '../../../config';
import { inRange } from '../../../utils/utils';
import { areaFromBounds } from '../../../utils/map';
import {
  useCheckpoint,
  actions as checkpointActions,
} from '../../../context/checkpoint';
import ModalMapEvent from './modal-events';

import GeoJSONLayer from '../../common/map/geojson-layer';
import TileLayerWithHeaders from '../../common/map/tile-layer';
import { useAuth } from '../../../context/auth';
import { useApiMeta } from '../../../context/api-meta';
import { useAoi, useAoiPatch, useAoiName } from '../../../context/aoi';
import {
  actions as predictionActions,
  usePredictions,
} from '../../../context/predictions';
import toasts from '../../common/toasts';
import logger from '../../../utils/logger';

const center = [38.83428180092151, -79.37724530696869];
const zoom = 15;

const MAX = 3;
const NO_LIVE = 2;
const LIVE = 1;

const Container = styled.div`
  height: 100%;
  z-index: 1;
  user-select: none;

  .leaflet-draw-toolbar,
  .leaflet-draw-actions {
    visibility: hidden;
  }

  .leaflet-top.leaflet-left {
    /* Shift control container vertically */
    top: 7.5vh;
    .leaflet-geosearch-button.active form {
      /* CSS quirk to make input box the right height */
      line-height: 2.5;
    }
    .leaflet-control {
      margin-left: ${multiply(themeVal('layout.space'), 0.5)};
    }

    .leaflet-control.leaflet-draw {
      box-shadow: none;
    }
  }
`;

function Map() {
  const {
    aoiArea,
    setAoiArea,
    aoiInitializer,
    setAoiBounds,
    predictions,
    currentProject,
  } = useContext(ExploreContext);

  const { apiLimits } = useApiMeta();
  const { aoiRef, setAoiRef, currentAoi } = useAoi();
  const { updateAoiName } = useAoiName();

  const { restApiClient } = useAuth();
  const { aoiPatchList } = useAoiPatch();

  const { mapState, mapModes, setMapMode } = useMapState();
  const { mapRef, setMapRef } = useMapRef();
  const [tileUrl, setTileUrl] = useState(null);
  const { dispatchPredictions } = usePredictions();

  const { mapLayers, setMapLayers } = useMapLayers();
  const { userLayers, setUserLayers } = useUserLayers();

  const { mosaicList } = useContext(GlobalContext);
  const { currentCheckpoint, dispatchCurrentCheckpoint } = useCheckpoint();

  const { mosaics } = mosaicList.isReady() ? mosaicList.getData() : {};

  // Manage changes in map mode
  useEffect(() => {
    switch (mapState.mode) {
      case mapModes.CREATE_AOI_MODE:
        mapRef.aoi.control.draw.enable();
        mapRef.polygonDraw.disable();
        break;
      case mapModes.EDIT_AOI_MODE:
        mapRef.aoi.control.draw.disable();
        mapRef.aoi.control.edit.enable(aoiRef);
        mapRef.polygonDraw.disable();
        break;
      case mapModes.BROWSE_MODE:
        if (mapRef) {
          mapRef.polygonDraw.disable();
          if (aoiRef) {
            // Only disable if something has been drawn
            mapRef.aoi.control.draw.disable();
            if (mapRef.aoi.control.edit._shape) {
              mapRef.aoi.control.edit.disable();
            }
            if (
              mapState.previousMode === mapModes.CREATE_AOI_MODE ||
              mapState.previousMode === mapModes.EDIT_AOI_MODE
            ) {
              // On confirm, zoom to bounds
              mapRef.fitBounds(aoiRef.getBounds(), { padding: BOUNDS_PADDING });
            }
          }
        }
        break;
      case mapModes.ADD_SAMPLE_POLYGON:
        if (currentCheckpoint && currentCheckpoint.activeItem) {
          mapRef.polygonDraw.enableAdd(currentCheckpoint.activeItem);
        }
        break;

      case mapModes.DELETE_SAMPLES:
        if (currentCheckpoint && currentCheckpoint.activeItem) {
          mapRef.polygonDraw.enableSubtract(currentCheckpoint.activeItem);
        }
        break;

      default:
        mapRef.polygonDraw.disable();
        break;
    }
  }, [
    mapState.mode,
    aoiRef,
    currentCheckpoint && currentCheckpoint.activeItem,
  ]);

  const classLength =
    currentCheckpoint && currentCheckpoint.classes
      ? Object.keys(currentCheckpoint.classes).length
      : 0;
  const id = currentCheckpoint ? currentCheckpoint.id : null;

  // Add polygon layers to be drawn when checkpoint has changed
  useEffect(() => {
    if (!mapRef || !mapRef.polygonDraw) return;

    mapRef.polygonDraw.clearLayers();

    if (currentCheckpoint && currentCheckpoint.classes) {
      mapRef.polygonDraw.setLayers(currentCheckpoint.classes);
      mapRef.polygonDraw.setLayerPolygons(currentCheckpoint.classes);
    }
  }, [mapRef, id, classLength]);

  /**
   * Add/update AOI controls on API metadata change.
   */
  useEffect(() => {
    if (!mapRef) return;

    // Setup AOI controllers
    mapRef.aoi = {
      control: {},
    };

    // Draw control, for creating an AOI
    mapRef.aoi.control.draw = new AoiDrawControl(
      mapRef,
      aoiInitializer,
      apiLimits,
      {
        onInitialize: (bbox, shape) => {
          setAoiRef(shape);
          setAoiBounds(shape.getBounds());
          setAoiArea(areaFromBounds(bbox));

          mapRef.fitBounds(shape.getBounds(), { padding: BOUNDS_PADDING });
        },
        onDrawStart: (shape) => {
          setAoiRef(shape);
        },
        onDrawChange: (bbox) => {
          setAoiArea(areaFromBounds(bbox));
        },
        onDrawEnd: (bbox, shape) => {
          setAoiRef(shape);

          const bounds = shape.getBounds();
          setAoiBounds(bounds);
          setMapMode(mapModes.BROWSE_MODE);
          updateAoiName(bounds);
        },
      }
    );

    // Edit AOI control
    mapRef.aoi.control.edit = new AoiEditControl(mapRef, apiLimits, {
      onBoundsChange: (bbox) => {
        setAoiArea(areaFromBounds(bbox));
      },
    });
  }, [mapRef, aoiInitializer, apiLimits]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update color on area size change during draw
  useEffect(() => {
    if (!aoiRef || !apiLimits) {
      return;
    }

    const { max_inference, live_inference } = apiLimits;

    if (inRange(aoiArea, max_inference, Infinity) && aoiRef.status !== MAX) {
      aoiRef.setStyle({
        color: theme.main.color.danger,
      });
      aoiRef.status = MAX;
    } else if (
      inRange(aoiArea, live_inference, max_inference) &&
      aoiRef.status !== NO_LIVE
    ) {
      aoiRef.setStyle({
        color: theme.main.color.warning,
      });
      aoiRef.status = NO_LIVE;
    } else if (inRange(aoiArea, 0, live_inference) && aoiRef.status !== LIVE) {
      aoiRef.setStyle({
        color: theme.main.color.info,
      });
      aoiRef.status = LIVE;
    }
  }, [aoiArea, apiLimits, aoiRef]);

  

  useEffect(() => {
    async function updateTileUrl() {
      if (mapRef && currentProject && currentAoi) {
        try {
          const tileJSON = await restApiClient.getTileJSON(
            currentProject.id,
            currentAoi.id
          );
          setTileUrl(`${config.restApiEndpoint}${tileJSON.tiles[0]}`);
        } catch (error) {
          logger(error);
          toasts.error('Could not load AOI map');
        }
      }
    }
    updateTileUrl();
  }, [currentAoi, currentProject, mapRef]);

  const displayMap = useMemo(() => {
    return (
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%' }}
        whenCreated={(m) => {
          const polygonDraw = new PolygonDrawControl(m, {
            onUpdate: (name, polygons) => {
              let isCheckpointPolygon;
              if (name.includes('checkpoint')) {
                isCheckpointPolygon = true;
              }
              // Assume class polygon
              dispatchCurrentCheckpoint({
                type: checkpointActions.UPDATE_POLYGONS,
                data: {
                  name,
                  isCheckpointPolygon,
                  polygons: polygons.map((f) => f.geometry),
                },
              });
            },
          });

          m.polygonDraw = polygonDraw;

          // Add map to state
          setMapRef(m);

          if (process.env.NODE_ENV !== 'production') {
            // makes map accessible in console for debugging
            window.map = m;
          }
        }}
      >
        {mapState.mode === mapModes.ADD_SAMPLE_POINT && (
          <ModalMapEvent
            event='click'
            func={(e) => {
              if (mapState.mode !== mapModes.ADD_SAMPLE_POINT) {
                return;
              }
              dispatchCurrentCheckpoint({
                type: checkpointActions.ADD_POINT_SAMPLE,
                data: e.latlng,
              });
            }}
          />
        )}

        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          maxZoom={18}
        />
        {mosaics &&
          mosaics.map((layer) => (
            <TileLayer
              key={layer}
              attribution='&copy; NAIP'
              url={config.tileUrlTemplate.replace('{LAYER_NAME}', layer)}
              minZoom={12}
              maxZoom={18}
              pane='tilePane'
              eventHandlers={{
                add: (v) => {
                  setMapLayers({
                    ...mapLayers,
                    [layer]: {
                      layer: v.target,
                      active: true,
                      name: layer,
                    },
                  });
                },
              }}
            />
          ))}

        {predictions &&
          predictions.data &&
          predictions.data.predictions &&
          predictions.data.predictions.map((p) => (
            <ImageOverlay
              key={p.key}
              url={p.image}
              bounds={p.bounds}
              opacity={
                userLayers.predictions.visible
                  ? userLayers.predictions.opacity
                  : 0
              }
            />
          ))}

        {aoiPatchList.map((patch) => {
          // Id format set in context/map.js

          return (
            <React.Fragment key={patch.id}>
              {patch.patches.map((p) => (
                <ImageOverlay
                  key={p.key}
                  url={p.image}
                  bounds={p.bounds}
                  pane='markerPane'
                  opacity={
                    userLayers.refinementsLayer.visible
                      ? userLayers.refinementsLayer.opacity
                      : 0
                  }
                />
              ))}
            </React.Fragment>
          );
        })}

        {currentCheckpoint &&
          currentCheckpoint.retrain_geoms &&
          userLayers.retrainingSamples.active &&
          currentCheckpoint.retrain_geoms.map((geoms, i) => {
            return (
              <GeoJSONLayer
                key={Object.keys(currentCheckpoint.classes)[i]}
                data={{
                  type: 'Feature',
                  geometry: geoms,
                  properties: {
                    id: currentCheckpoint.id,
                  },
                }}
                style={{
                  stroke: false,
                  fillColor: Object.values(currentCheckpoint.classes)[i].color,
                  fillOpacity: userLayers.retrainingSamples.opacity,
                }}
                opacity={
                  userLayers.retrainingSamples.visible
                    ? userLayers.retrainingSamples.opacity
                    : 0
                }
                pointToLayer={function (feature, latlng) {
                  return L.circleMarker(latlng, {
                    radius: 4,
                  });
                }}
              />
            );
          })}

        {tileUrl &&
          currentProject &&
          currentCheckpoint &&
          currentAoi &&
          !predictions.fetching && (
            <TileLayerWithHeaders
              url={tileUrl}
              maxZoom={18}
              headers={[
                {
                  header: 'Authorization',
                  value: `Bearer ${restApiClient.apiToken}`,
                },
              ]}
              options={{
                pane: 'overlayPane',
              }}
              opacity={
                userLayers.predictions.visible
                  ? userLayers.predictions.opacity
                  : 0
              }
              eventHandlers={{
                add: () => {
                  if (predictions.isReady() || !predictions.data.predictions) {
                    setUserLayers({
                      ...userLayers,
                      predictions: {
                        ...userLayers.predictions,
                        active: true,
                      },
                    });
                  }
                },
                load: () => {
                  if (predictions.isReady() || !predictions.data.predictions) {
                    setTimeout(() => {
                      dispatchPredictions({
                        type: predictionActions.CLEAR_PREDICTION,
                      });
                    }, 1000);
                  }
                },
                remove: () => {
                  setUserLayers({
                    ...userLayers,
                    predictions: {
                      ...userLayers.predictions,
                      active: false,
                    },
                  });
                },
              }}
            />
          )}

        {currentCheckpoint &&
          currentCheckpoint.classes &&
          Object.values(currentCheckpoint.classes).map(
            (sampleClass) =>
              sampleClass.points &&
              sampleClass.points.coordinates &&
              sampleClass.points.coordinates.map(([lat, lng]) => (
                <Circle
                  key={JSON.stringify([lat, lng])}
                  pathOptions={{
                    color: sampleClass.color,
                  }}
                  eventHandlers={{
                    click: () => {
                      if (mapState.mode === mapModes.DELETE_SAMPLES) {
                        dispatchCurrentCheckpoint({
                          type: checkpointActions.REMOVE_POINT_SAMPLE,
                          data: {
                            className: sampleClass.name,
                            lat,
                            lng,
                          },
                        });
                      }
                    },
                  }}
                  center={[lng, lat]}
                  radius={10}
                />
              ))
          )}
        <FeatureGroup>
          <GeoCoder />
          {aoiRef && <CenterMap aoiRef={aoiRef} />}
        </FeatureGroup>
      </MapContainer>
    );
  }, [
    mapModes,
    aoiRef,
    currentAoi,
    currentCheckpoint,
    dispatchCurrentCheckpoint,
    userLayers,
    mapLayers,
    mosaics,
    mapState.mode,
    predictions.data.predictions,
    restApiClient,
    setMapLayers,
    setMapRef,
    aoiPatchList,
    tileUrl,
  ]);

  return (
    <SizeAwareElement
      element={Container}
      id='map'
      data-cy='leaflet-map'
      onChange={() => {
        if (mapRef) {
          mapRef.invalidateSize();
        }
      }}
    >
      {displayMap}
    </SizeAwareElement>
  );
}

export default Map;
