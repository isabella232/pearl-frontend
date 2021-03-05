import React from 'react';
import styled from 'styled-components';
import T from 'prop-types';
import { toTitleCase } from '../../utils/format';
const List = styled.ol`
  li {
    display: grid;
    grid-template-columns: 1fr 2fr;
  }
`;

function DetailsList(props) {
  const { details } = props;
  return (
    <List>
      {Object.entries(details).map(([key, value]) => (
        <li key={key}>
          <strong>{toTitleCase(key)}</strong>
          <p>{value}</p>
        </li>
      ))}
    </List>
  );
}

DetailsList.propTypes = {
  details: T.object,
};

export default DetailsList;
