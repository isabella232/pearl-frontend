import React from 'react';
import T from 'prop-types';
import get from 'lodash.get';
import { Button } from '@devseed-ui/button';
import InfoButton from '../../common/info-button';
import styled from 'styled-components';
import { glsp } from '@devseed-ui/theme-provider';
import { Heading } from '@devseed-ui/typography';
import { PlaceholderMessage } from '../../../styles/placeholder.js';
import { actions, useCheckpoint } from '../../../context/checkpoint.js';
import { useMapState } from '../../../context/explore.js';
import {
  ClassList,
  Class,
  Thumbnail,
  ToolBox as RetrainTools,
} from './retrain-refine-styles';

const Wrapper = styled.div`
  display: grid;
  grid-gap: ${glsp()};
`;

/*
 * Retrain Model
 * @param ready - true when checkpoint exists and we are in RETRAIN mode
 */

function RetrainModel(props) {
  const { ready, className, placeholderMessage } = props;

  const { currentCheckpoint, dispatchCurrentCheckpoint } = useCheckpoint();

  const { setMapMode, mapModes, mapState } = useMapState();

  return (
    <Wrapper className={className}>
      {ready && currentCheckpoint.classes && (
        <>
          <RetrainTools>
            <Heading useAlt>Sample Selection Tools</Heading>
            <InfoButton
              variation={
                mapState.mode === mapModes.ADD_SAMPLE_POLYGON
                  ? 'primary-raised-dark'
                  : 'primary-raised-light'
              }
              size='small'
              radius='ellipsoid'
              useIcon='pencil'
              visuallyDisabled={!currentCheckpoint.activeItem}
              info={!currentCheckpoint.activeItem && 'No active item selected'}
              onClick={() => {
                if (currentCheckpoint.activeItem) {
                  setMapMode(mapModes.ADD_SAMPLE_POLYGON);
                }
              }}
            >
              Draw
            </InfoButton>
            <InfoButton
              variation={
                mapState.mode === mapModes.ADD_SAMPLE_POINT
                  ? 'primary-raised-dark'
                  : 'primary-raised-light'
              }
              size='small'
              radius='ellipsoid'
              useIcon='crosshair'
              visuallyDisabled={!currentCheckpoint.activeItem}
              info={!currentCheckpoint.activeItem && 'No active item selected'}
              onClick={() => {
                if (currentCheckpoint.activeItem) {
                  setMapMode(mapModes.ADD_SAMPLE_POINT);
                }
              }}
            >
              Point
            </InfoButton>
            <InfoButton
              variation={
                mapState.mode === mapModes.REMOVE_SAMPLE
                  ? 'primary-raised-dark'
                  : 'primary-raised-light'
              }
              size='small'
              radius='ellipsoid'
              useIcon='xmark'
              visuallyDisabled={!currentCheckpoint.activeItem}
              info={!currentCheckpoint.activeItem && 'No active item selected'}
              onClick={() => {
                if (currentCheckpoint.activeItem) {
                  setMapMode(mapModes.REMOVE_SAMPLE);
                }
              }}
            >
              Delete
            </InfoButton>
          </RetrainTools>
          <ClassList>
            <Heading useAlt>Classes</Heading>
            {Object.values(currentCheckpoint.classes).map((c) => (
              <Class
                key={c.name}
                onClick={() => {
                  dispatchCurrentCheckpoint({
                    type: actions.SET_ACTIVE_CLASS,
                    data: c.name,
                  });
                }}
                selected={currentCheckpoint.activeItem === c.name}
              >
                <Thumbnail color={c.color} />
                <Heading size='xsmall'>
                  {c.name} (
                  {get(c, 'points.coordinates.length', 0) +
                    get(c, 'polygons.length', 0)}{' '}
                  samples)
                  {currentCheckpoint.activeItem === c.name ? ' (Active)' : ''}
                </Heading>

                <Button useIcon='cog' hideText variation='base-plain'>
                  Options
                </Button>
              </Class>
            ))}
            <Class className='add__class' muted as={Button}>
              <Thumbnail useIcon='plus' outline />
              <Heading size='xsmall'>Add Class</Heading>
            </Class>
          </ClassList>
        </>
      )}

      {!currentCheckpoint && placeholderMessage && (
        <ClassList>
          {[1, 2, 3].map((i) => (
            // +true workaround
            // Styled components will try to pass true to the DOM element
            // assing a + casts it to int which is logically equivalent
            // but does not cause the DOM error
            <Class key={i} placeholder={+true} className='placeholder-class'>
              <Thumbnail />
              <Heading size='xsmall' />
              <Button disabled size='small' variation='base-raised-semidark' />
            </Class>
          ))}
          <PlaceholderMessage>{placeholderMessage}</PlaceholderMessage>
        </ClassList>
      )}

      {!ready && currentCheckpoint && (
        <PlaceholderMessage>
          Please submit or clear retraining samples before refining results
        </PlaceholderMessage>
      )}
    </Wrapper>
  );
}

RetrainModel.propTypes = {
  className: T.string,
  placeholderMessage: T.string,
  ready: T.bool,
};
export default RetrainModel;
