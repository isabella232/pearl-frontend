import React, { useEffect, useState } from 'react';
import styled, { css } from 'styled-components';
import { Button } from '@devseed-ui/button';
import collecticon from '@devseed-ui/collecticons';
import {
  Inpage,
  InpageHeader,
  InpageHeaderInner,
  InpageHeadline,
  InpageTitle,
  InpageBody,
  InpageBodyInner,
} from '../../../styles/inpage';
import { glsp } from '@devseed-ui/theme-provider';
import { Heading } from '@devseed-ui/typography';
import { StyledNavLink } from '../../../styles/links';
import { useAuth } from '../../../context/auth';
import { formatDateTime } from '../../../utils/format';
import App from '../../common/app';
import PageHeader from '../../common/page-header';
import { PageBody } from '../../../styles/page';
import {
  showGlobalLoadingMessage,
  hideGlobalLoading,
} from '../../common/global-loading';
import Table, { TableRow, TableCell } from '../../common/table';
import logger from '../../../utils/logger';
import { Link } from 'react-router-dom';

const HEADERS = ['Name', 'Created', 'Active', 'Uploaded'];

export const ModelsBody = styled(InpageBodyInner)`
  display: grid;
  grid-template-columns: 1fr;
  grid-auto-rows: auto 1fr;
  grid-gap: ${glsp()};
  padding-top: 0;
`;

export const BooleanIcon = styled.div`
  ${({ value }) =>
    css`
      &::before {
        ${value ? collecticon('tick--small') : collecticon('xmark--small')}
      }
    `}
`;

export const ModelsHeadline = styled(InpageHeadline)`
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: 1fr;
  width: 100%;
  justify-content: space-between;
  align-items: center;
`;

// Render single models row
function renderRow(model) {
  return (
    <TableRow key={model.id}>
      <TableCell>
        <StyledNavLink to={`/admin/models/${model.id}`}>
          {model.name}
        </StyledNavLink>
      </TableCell>
      <TableCell>{formatDateTime(model.created)}</TableCell>
      <TableCell>
        <BooleanIcon value={model.active} />
      </TableCell>
      <TableCell>
        <BooleanIcon value={model.storage} />
      </TableCell>
    </TableRow>
  );
}

export default function ModelIndex() {
  const { apiToken } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [models, setModels] = useState([]);

  const { restApiClient } = useAuth();

  useEffect(() => {
    async function fetchModels() {
      if (apiToken) {
        try {
          showGlobalLoadingMessage('Loading models...');
          const data = await restApiClient.get(`model/?active=all&storage=all`);
          setModels(data.models);
        } catch (error) {
          logger(error);
        } finally {
          hideGlobalLoading();
          setIsLoading(false);
        }
      }
    }
    fetchModels();
  }, [apiToken]);

  return (
    <App pageTitle='Models'>
      <PageHeader />
      <PageBody role='main'>
        <Inpage>
          <InpageHeader>
            <InpageHeaderInner>
              <ModelsHeadline>
                <InpageTitle>
                  <Link to='/admin/models'>Models</Link>
                </InpageTitle>
                <Button
                  forwardedAs={StyledNavLink}
                  to='/admin/models/new'
                  variation='primary-plain'
                  size='large'
                  useIcon='plus'
                  title='Start a new model'
                >
                  New Model
                </Button>
              </ModelsHeadline>
            </InpageHeaderInner>
          </InpageHeader>
          <InpageBody>
            <ModelsBody>
              {models &&
                (models.length ? (
                  <>
                    <Table
                      headers={HEADERS}
                      data={models}
                      renderRow={renderRow}
                      hoverable
                    />
                  </>
                ) : (
                  <Heading>
                    {isLoading ? 'Loading Models...' : 'No models found.'}
                  </Heading>
                ))}
            </ModelsBody>
          </InpageBody>
        </Inpage>
      </PageBody>
    </App>
  );
}
