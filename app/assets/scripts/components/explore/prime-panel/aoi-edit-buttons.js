import React, { useState } from 'react';
import T from 'prop-types';
import L from 'leaflet';
import styled from 'styled-components';
import { Button } from '@devseed-ui/button';
import { glsp, themeVal } from '@devseed-ui/theme-provider';
import {
  Modal,
  ModalHeadline,
  ModalFooter as BaseModalFooter,
} from '@devseed-ui/modal';

import { EditButton } from '../../../styles/button';
import { BOUNDS_PADDING } from '../../common/map/constants';
import { useMapState, useAoiMeta } from '../../../context/explore';
import { useMapRef } from '../../../context/map';
import { useApiLimits, useMosaics } from '../../../context/global';
import { useInstance } from '../../../context/instance';
import { useAoi, useAoiName } from '../../../context/aoi';
import {
  useCheckpoint,
  actions as checkpointActions,
  checkpointModes,
} from '../../../context/checkpoint';
import { formatThousands } from '../../../utils/format';
import { areaFromBounds } from '../../../utils/map';
import logger from '../../../utils/logger';
import config from '../../../config';
import { UploadAoiModal } from './upload-aoi-modal';
import booleanWithin from '@turf/boolean-within';
import bboxPolygon from '@turf/bbox-polygon';

const ModalFooter = styled(BaseModalFooter)`
  padding: ${glsp(2)} 0 0 0;
  > button,
  ${Button} {
    flex: 1;
    margin: 0;
    border-radius: 0;
  }
`;

const Separator = styled.span`
  color: ${themeVal('color.baseAlphaD')};
`;

const ActiveModalHeadline = ({ activeModal }) => {
  const messages = {
    'batch-inference': 'Save Area For Batch Prediction',
    'area-too-large': 'Area is too large',
    'area-too-tiny': 'Area is too tiny',
    'area-out-of-bounds': 'Area is out of imagery bounds',
  };

  return (
    <ModalHeadline>
      <h1>{messages[activeModal]}</h1>
    </ModalHeadline>
  );
};

ActiveModalHeadline.propTypes = {
  activeModal: T.string,
};

const ActiveModalContent = ({ activeModal, aoiArea }) => {
  const { apiLimits } = useApiLimits();

  const maxArea = formatThousands(apiLimits.live_inference / 1e6);
  const formattedAoiArea = formatThousands(aoiArea / 1e6, { decimals: 1 });
  const messages = {
    'batch-inference': `Live inference is not available for areas larger
      than ${maxArea} km². You can run inference on this AOI as a background
      process, or resize to a smaller size to engage in retraining and run
      live inference.`,
    'area-too-large': `The AOI area is ${formattedAoiArea} km², please select an
      area smaller than ${maxArea} km².`,
    'area-too-tiny': `The AOI area is ${formattedAoiArea} km², please select an
      area greater than ${config.minimumAoiArea / 1e6} km².`,
    'area-out-of-bounds': `The AOI is outside of imagery bounds`,
  };

  return <div>{messages[activeModal]}</div>;
};
ActiveModalContent.propTypes = {
  activeModal: T.string,
  aoiArea: T.number,
};

export function AoiEditButtons(props) {
  const { deleteAoi } = props;

  const { runningBatch } = useInstance();
  const { mapState, setMapMode, mapModes } = useMapState();
  const [showUploadAoiModal, setShowUploadAoiModal] = useState(false);
  // updateAoiName applies geocoding
  const { updateAoiName } = useAoiName();
  const {
    currentAoi,
    setCurrentAoi,
    activeModal,
    setActiveModal,
    setAoiArea,

    // Set aoiname sets a string directly
    setAoiName,
    aoiRef,
    setAoiRef,
  } = useAoi();

  const { aoiArea, aoiBounds, setAoiBounds, createNewAoi } = useAoiMeta();
  const { mapRef } = useMapRef();

  const { mosaicMeta } = useMosaics();

  const { dispatchCurrentCheckpoint, currentCheckpoint } = useCheckpoint();

  const { apiLimits } = useApiLimits();

  // Confirm AOI, used in finish edit button and "confirm batch inference" modal
  function applyAoi() {
    setMapMode(mapModes.BROWSE_MODE);
    let bounds = aoiRef.getBounds();
    setAoiBounds(bounds);
    updateAoiName(bounds);

    // When AOI is edited -> we go to run mode
    if (currentCheckpoint) {
      dispatchCurrentCheckpoint({
        type: checkpointActions.SET_CHECKPOINT_MODE,
        data: {
          mode: checkpointModes.RUN,
        },
      });
    }

    //Current AOI should only be set after AOI has been sent to the api
    setCurrentAoi(null);
  }

  // Display confirm/cancel buttons when AOI editing is active
  if (
    mapState.mode === mapModes.CREATE_AOI_MODE ||
    mapState.mode === mapModes.EDIT_AOI_MODE
  ) {
    return (
      <>
        {aoiArea > 0 && (
          <EditButton
            onClick={function () {
              const bounds = aoiRef.getBounds();

              const aoiBboxPolygon = bboxPolygon([
                bounds.getWest(),
                bounds.getSouth(),
                bounds.getEast(),
                bounds.getNorth(),
              ]);

              const mosaicBounds = bboxPolygon(mosaicMeta.data.bounds);

              if (!booleanWithin(aoiBboxPolygon, mosaicBounds)) {
                setActiveModal('area-out-of-bounds');
                return;
              }

              if (aoiArea < config.minimumAoiArea) {
                setActiveModal('area-too-tiny');
                return;
              }
              if (!apiLimits || apiLimits.live_inference > aoiArea) {
                applyAoi();
              } else if (apiLimits.max_inference > aoiArea) {
                setActiveModal('batch-inference');
              } else {
                setActiveModal('area-too-large');
              }
            }}
            title='Set Area of Interest'
            useIcon='tick'
            data-cy='aoi-edit-confirm-button'
          >
            Select AOI
          </EditButton>
        )}
        <EditButton
          onClick={() => {
            setMapMode(mapModes.BROWSE_MODE);
            if (aoiBounds) {
              // editing is canceled
              aoiRef.setBounds(aoiBounds);
              const bbox = [
                aoiBounds.getWest(),
                aoiBounds.getSouth(),
                aoiBounds.getEast(),
                aoiBounds.getNorth(),
              ];

              setAoiArea(areaFromBounds(bbox));
            } else {
              // Drawing canceled
              mapRef.aoi.control.draw.disable();

              //Edit mode is enabled as soon as draw is done
              if (mapRef.aoi.control.edit._shape) {
                mapRef.aoi.control.edit.disable();
              }

              //Layer must be removed from the map
              mapRef.aoi.control.draw.clear();

              // Layer ref set to null, will be recreated when draw is attempted again
              setAoiRef(null);
            }
          }}
          useIcon='xmark'
          data-cy='aoi-edit-cancel-button'
        >
          Select AOI
        </EditButton>
        {activeModal && (
          <Modal
            id='confirm-area-size'
            revealed={true}
            size='small'
            closeButton={false}
            renderHeadline={() => (
              <ActiveModalHeadline activeModal={activeModal} />
            )}
            content={
              <ActiveModalContent activeModal={activeModal} aoiArea={aoiArea} />
            }
            renderFooter={() => (
              <ModalFooter>
                {activeModal && activeModal === 'batch-inference' && (
                  <Button
                    size='xlarge'
                    variation='base-plain'
                    data-cy='proceed-anyway-button'
                    onClick={() => {
                      setActiveModal(false);
                      applyAoi();
                    }}
                  >
                    Proceed anyway
                  </Button>
                )}
                <Button
                  size='xlarge'
                  data-cy='keep-editing-button'
                  variation='primary-plain'
                  onClick={() => {
                    setActiveModal(false);
                    setMapMode(mapModes.EDIT_AOI_MODE);
                  }}
                >
                  Keep editing
                </Button>
              </ModalFooter>
            )}
          />
        )}
      </>
    );
  }

  return (
    <>
      {
        // Only show Add AOI button if at least one AOI exists
        (currentAoi || runningBatch) && (
          <EditButton
            useIcon='plus'
            onClick={() => {
              createNewAoi();
              mapRef.aoi.control.draw.disable();
              //Layer must be removed from the map
              mapRef.aoi.control.draw.clear();
            }}
            data-cy='add-aoi-button'
            data-dropdown='click.close'
            title='Draw new AOI'
          >
            Add AOI
          </EditButton>
        )
      }
      <EditButton
        title='Upload AOI GeoJSON'
        data-cy='upload-aoi-modal-button'
        id='upload-aoi-modal-button'
        useIcon='upload'
        onClick={() => setShowUploadAoiModal(true)}
      >
        Upload AOI
      </EditButton>

      <Separator>|</Separator>

      {currentAoi ? (
        /*  If currentAoi, AOI has been submitted to api
         *  on delete, delete it via the api
         */
        <EditButton
          onClick={() => deleteAoi(currentAoi)}
          title='Delete Current AOI'
          id='delete-aoi'
          useIcon='trash-bin'
          data-cy='delete-current-aoi-button'
        >
          Delete Current AOI
        </EditButton>
      ) : (
        /* If not currentAoi but aoiRef exists, AOI has not been submitted to AOI
         * just clear it from the map and return to create
         * new AOI state
         */
        aoiRef && (
          <EditButton
            onClick={() => {
              mapRef.aoi.control.draw.clear();
              setAoiRef(null);
              setAoiBounds(null);
              setAoiArea(null);
              setAoiName(null);
            }}
            title='Delete current AOI'
            id='delete-aoi'
            useIcon='trash-bin'
            data-cy='delete-current-aoi-button'
          >
            Delete current AOI
          </EditButton>
        )
      )}
      <UploadAoiModal
        revealed={showUploadAoiModal}
        setRevealed={setShowUploadAoiModal}
        apiLimits={apiLimits}
        mosaicMeta={mosaicMeta}
        onImport={({ bounds, totalArea }) => {
          try {
            let aoiShape;
            const [minX, minY, maxX, maxY] = bounds;
            const leafletBounds = [
              [minY, minX],
              [maxY, maxX],
            ];
            if (!aoiRef) {
              aoiShape = L.rectangle(leafletBounds).addTo(mapRef);
              setAoiRef(aoiShape);
            } else {
              aoiShape = aoiRef;
              aoiRef.setBounds(leafletBounds);
            }

            mapRef.fitBounds(aoiShape.getBounds(), {
              padding: BOUNDS_PADDING,
            });
            setAoiArea(totalArea);
            setAoiBounds(aoiShape.getBounds());
            setMapMode(mapModes.EDIT_AOI_MODE);

            return true;
          } catch (error) {
            logger(error);
            return false;
          }
        }}
      />
      <EditButton
        onClick={() => {
          setMapMode(
            !aoiRef ? mapModes.CREATE_AOI_MODE : mapModes.EDIT_AOI_MODE
          );
        }}
        title={!aoiRef ? 'Draw Area of Interest' : 'Edit Current AOI'}
        id='edit-aoi-trigger'
        useIcon='pencil'
        data-cy='aoi-edit-button'
      >
        Select AOI
      </EditButton>
    </>
  );
}

AoiEditButtons.propTypes = {
  deleteAoi: T.func,
};
