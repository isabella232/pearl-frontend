import React, { useEffect, useState, useContext } from 'react';
import styled from 'styled-components';
import { media, glsp } from '@devseed-ui/theme-provider';

import Panel from '../../common/panel';
import { PanelBlock, PanelBlockBody } from '../../common/panel-block';
import SelectModal from '../../common/select-modal';
import ModelCard from './model-card';
import { useMapRef } from '../../../context/map';
import {
  ExploreContext,
  useMapState,
  useShortcutState,
  useAoiMeta,
} from '../../../context/explore';
import { useModel } from '../../../context/model';

import { Heading } from '@devseed-ui/typography';
import { Button } from '@devseed-ui/button';

import TabbedBlock from '../../common/tabbed-block-body';
import Predict from './tabs/predict';
import RetrainModel from './tabs/retrain-model';
import RefineResults from './tabs/refine-results';

import PanelFooter from './footer';
import {
  useCheckpoint,
  actions as checkpointActions,
  checkpointModes,
} from '../../../context/checkpoint';
import { useAoi } from '../../../context/aoi';
import { usePredictions } from '../../../context/predictions';
import { useApiLimits } from '../../../context/global';
import ClearSamplesModal from './clear-samples-modal';
import { actions as shortcutActions } from '../../../context/explore/shortcuts';

const StyledPanelBlock = styled(PanelBlock)`
  ${media.largeUp`
    width: ${glsp(24)};
  `}
`;

const ModalHeader = styled.header`
  padding: ${glsp(2)};
`;

const Headline = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding-bottom: ${glsp(1)};

  h1 {
    margin: 0;
  }

  ${Button} {
    height: min-content;
    align-self: center;
  }
`;
const TABS = [0, 1, 2];
const [PREDICT_TAB_INDEX, RETRAIN_TAB_INDEX, REFINE_TAB_INDEX] = TABS;

function PrimePanel() {
  const { mapState, mapModes, setMapMode } = useMapState();
  const { mapRef } = useMapRef();
  const { apiLimits } = useApiLimits();
  const { shortcutState, dispatchShortcutState } = useShortcutState();

  const { updateCheckpointName } = useContext(ExploreContext);

  const { setAoiBounds, aoiArea } = useAoiMeta();

  const { aoiRef, currentAoi } = useAoi();

  const { currentCheckpoint, dispatchCurrentCheckpoint } = useCheckpoint();

  const { models, selectedModel, setSelectedModel } = useModel();

  const { predictions } = usePredictions();

  const [showSelectModelModal, setShowSelectModelModal] = useState(false);
  const [showClearSamplesModal, setShowClearSamplesModal] = useState(null);

  const [localCheckpointName, setLocalCheckpointName] = useState(
    (currentCheckpoint &&
      currentCheckpoint.bookmarked &&
      currentCheckpoint.name) ||
      ''
  );

  const [activeTab, setActiveTab] = useState(0);

  // Retrain Panel Tab Empty State message
  const retrainPlaceHolderMessage = () => {
    if (predictions.isReady()) {
      // If predictions are ready, do not need a placeholder
      return null;
    }
    if (
      (aoiRef && selectedModel) ||
      !currentAoi ||
      aoiArea > apiLimits['live_inference']
    ) {
      return `Click the "Run Model" button to generate the class LULC map for your AOI`;
    } else if (aoiRef && !selectedModel) {
      return `Select a model to use for inference`;
    } else {
      return `Define an Area of Interest to run models at your selected location`;
    }
  };

  const checkpointHasSamples =
    currentCheckpoint && currentCheckpoint.sampleCount > 0;

  useEffect(() => {
    if (currentCheckpoint) {
      if (currentCheckpoint.name) {
        if (currentCheckpoint.bookmarked) {
          setLocalCheckpointName(currentCheckpoint.name);
        } else {
          setLocalCheckpointName('');
        }
      }

      if (currentCheckpoint.mode === checkpointModes.RETRAIN) {
        setActiveTab(RETRAIN_TAB_INDEX);
      }
    }
  }, [currentCheckpoint?.id, currentCheckpoint?.mode]);

  return (
    <>
      <Panel
        data-cy='primary-panel'
        collapsible
        overrideControl
        revealed={shortcutState.leftPanel}
        onPanelChange={() => {
          dispatchShortcutState({ type: shortcutActions.TOGGLE_LEFT_PANEL });
        }}
        direction='left'
        initialState={true}
        fitContent
        bodyContent={
          <StyledPanelBlock>
            <PanelBlockBody>
              <TabbedBlock activeTab={activeTab}>
                <Predict
                  name='predict'
                  className='predict-model'
                  tabId='predict-tab-trigger'
                  checkpointHasSamples={checkpointHasSamples}
                  setShowSelectModelModal={setShowSelectModelModal}
                  onTabClick={() => {
                    function onContinue() {
                      setActiveTab(PREDICT_TAB_INDEX);
                      dispatchCurrentCheckpoint({
                        type: checkpointActions.SET_CHECKPOINT_MODE,
                        data: {
                          mode: checkpointModes.RUN,
                        },
                      });
                    }
                    if (checkpointHasSamples) {
                      setShowClearSamplesModal(() => onContinue);
                    } else {
                      onContinue();
                    }
                  }}
                />
                <RetrainModel
                  name='retrain model'
                  className='retrain-model'
                  tabId='retrain-tab-trigger'
                  placeholderMessage={retrainPlaceHolderMessage()}
                  ready={
                    currentCheckpoint &&
                    (currentCheckpoint.mode === checkpointModes.RETRAIN ||
                      currentCheckpoint.mode === checkpointModes.RUN) &&
                    currentCheckpoint.classes !== undefined &&
                    currentAoi
                  }
                  tabTooltip='Retrain is not availble until model has been run over AOI.'
                  disabled={
                    !currentCheckpoint ||
                    mapState.mode === mapModes.EDIT_AOI_MODE ||
                    !currentAoi
                  }
                  onTabClick={() => {
                    function onContinue() {
                      setActiveTab(RETRAIN_TAB_INDEX);
                      if (currentCheckpoint && currentAoi) {
                        setMapMode(mapModes.BROWSE_MODE);
                        dispatchCurrentCheckpoint({
                          type: checkpointActions.SET_ACTIVE_CLASS,
                          data: Object.values(currentCheckpoint.classes)[0]
                            .name,
                        });
                        if (currentCheckpoint.mode != checkpointModes.RETRAIN) {
                          // If current checkpoint has not been set,
                          // mode does not need to be set
                          dispatchCurrentCheckpoint({
                            type: checkpointActions.SET_CHECKPOINT_MODE,
                            data: {
                              mode: checkpointModes.RETRAIN,
                            },
                          });
                        }
                      }
                    }
                    if (checkpointHasSamples) {
                      setShowClearSamplesModal(() => onContinue);
                    } else {
                      onContinue();
                    }
                  }}
                />
                <RefineResults
                  name='Refine Results'
                  tabId='refine-tab-trigger'
                  className='refine-model'
                  disabled={
                    !currentCheckpoint ||
                    !currentAoi ||
                    mapState.mode === mapModes.EDIT_AOI_MODE
                  }
                  ready={
                    currentCheckpoint &&
                    currentCheckpoint.mode === checkpointModes.REFINE
                  }
                  tabTooltip='Refine is not available until model has been run or retrained.'
                  onTabClick={() => {
                    function onContinue() {
                      setActiveTab(REFINE_TAB_INDEX);
                      if (currentCheckpoint) {
                        setMapMode(mapModes.BROWSE_MODE);
                        dispatchCurrentCheckpoint({
                          type: checkpointActions.SET_ACTIVE_CLASS,
                          data: Object.values(currentCheckpoint.classes)[0]
                            .name,
                        });
                        if (currentCheckpoint.mode !== checkpointModes.REFINE) {
                          // If current checkpoint has not been set,
                          // mode does not need to be set
                          dispatchCurrentCheckpoint({
                            type: checkpointActions.SET_CHECKPOINT_MODE,
                            data: {
                              mode: checkpointModes.REFINE,
                            },
                          });
                        }
                      }
                    }

                    if (checkpointHasSamples) {
                      setShowClearSamplesModal(() => onContinue);
                    } else {
                      onContinue();
                    }
                  }}
                />
              </TabbedBlock>
            </PanelBlockBody>
            <PanelFooter
              {...{
                dispatchCurrentCheckpoint,
                currentCheckpoint,
                checkpointActions,

                updateCheckpointName,
                localCheckpointName,
                setLocalCheckpointName,

                mapRef,

                setAoiBounds,
                useSampleControls: activeTab > PREDICT_TAB_INDEX,

                disabled:
                  currentCheckpoint &&
                  (currentCheckpoint.mode === checkpointModes.RETRAIN ||
                    currentCheckpoint.mode === checkpointModes.REFINE),
              }}
            />
          </StyledPanelBlock>
        }
      />
      <SelectModal
        id='select-model-modal'
        revealed={showSelectModelModal}
        onOverlayClick={() => {
          setShowSelectModelModal(false);
        }}
        data={models.isReady && !models.hasError ? models.data : []}
        renderHeader={() => (
          <ModalHeader>
            <Headline>
              {' '}
              <Heading>Starter Models</Heading>
              <Button
                hideText
                variation='base-plain'
                size='small'
                useIcon='xmark'
                onClick={() => setShowSelectModelModal(false)}
              >
                Close modal
              </Button>
            </Headline>
          </ModalHeader>
        )}
        filterCard={(card) => {
          return card.name.includes('');
        }}
        renderCard={(model) => (
          <ModelCard
            key={model.name}
            model={model}
            onClick={() => {
              setShowSelectModelModal(false);
              setSelectedModel(model);
            }}
          />
        )}
        nonScrolling
      />
      <ClearSamplesModal
        revealed={showClearSamplesModal !== null}
        onClear={() => {
          dispatchCurrentCheckpoint({
            type: checkpointActions.CLEAR_SAMPLES,
          });
          mapRef.freehandDraw.clearLayers();
          let clearAndContinue = showClearSamplesModal;
          clearAndContinue();
          setShowClearSamplesModal(null);
        }}
        onCancel={() => {
          setShowClearSamplesModal(null);
        }}
      />
    </>
  );
}

export default PrimePanel;
