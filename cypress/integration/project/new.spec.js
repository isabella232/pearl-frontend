const {
  restApiEndpoint,
  instanceCreationCheckInterval,
} = require('../../../app/assets/scripts/config/testing').default;

const instance = {
  id: 1,
  project_id: 1,
  aoi_id: null,
  checkpoint_id: null,
  last_update: '2021-07-12T09:59:04.442Z',
  created: '2021-07-12T09:58:57.459Z',
  active: true,
  token: 'app_client',
  pod: {
    status: {
      phase: 'Pending',
    },
  },
};

describe('Create new project', () => {
  beforeEach(() => {
    cy.startServer();
    cy.fakeLogin();

    // Active instances list
    cy.intercept(
      {
        url: restApiEndpoint + '/api/project/1/instance/?status=active',
      },
      {
        total: 0,
        instances: [],
      }
    );

    // POST /project/:id/instance
    cy.intercept(
      {
        url: restApiEndpoint + '/api/project/1/instance',
        method: 'POST',
      },
      instance
    );
  });

  it('New project, instance creation fails', () => {
    // Set mock WS workflow in case creation succeeds (it shouldn't here)
    cy.setWebsocketWorkflow('base-model-prediction');

    // Visit page
    cy.visit('/project/new');

    // Set project name
    cy.get('[data-cy=modal-project-input]')
      .should('exist')
      .clear()
      .type('Project name');
    cy.get('[data-cy=create-project-button]').should('exist').click();

    // Draw AOI
    cy.get('[data-cy=aoi-edit-button]').should('exist').click();
    cy.get('#map')
      .trigger('mousedown', 150, 150)
      .trigger('mousemove', 200, 200)
      .trigger('mouseup');
    cy.wait('@reverseGeocodeCity');

    // Select model
    cy.get('[data-cy=select-model-label]').should('exist').click();
    cy.get('[data-cy=select-model-1-card]').should('exist').click();

    // Instance pending
    cy.intercept(
      {
        url: restApiEndpoint + '/api/project/1/instance/1',
      },
      {
        ...instance,
        status: {
          phase: 'Pending',
        },
      }
    );

    // Run
    cy.get('[data-cy=run-button').click();

    // Get to prediction halt point
    cy.get('[data-cy=session-status]').should(
      'have.text',
      'Session Status: Creating Instance...'
    );

    // Instance failed
    cy.intercept(
      {
        url: restApiEndpoint + '/api/project/1/instance/1',
      },
      {
        ...instance,
        pod: {
          status: {
            phase: 'Failed',
          },
        },
      }
    );

    // Get to prediction halt point
    cy.get('[data-cy=session-status]').should(
      'have.text',
      'Session Status: Instance creation failed.'
    );

    // Show toast
    cy.get('#a-toast').should(
      'contain',
      'Could not create instance, please try again later.'
    );

    // Instance pending
    cy.intercept(
      {
        url: restApiEndpoint + '/api/project/1/instance/1',
      },
      {
        ...instance,
        pod: {
          status: {
            phase: 'Pending',
          },
        },
      }
    );

    // Run
    cy.get('[data-cy=run-button').should('exist').click();

    // Get to prediction halt point
    cy.get('[data-cy=session-status]').should(
      'have.text',
      'Session Status: Creating Instance...'
    );

    // Wait one interval cycle
    cy.wait(instanceCreationCheckInterval);

    // Instance is running
    cy.intercept(
      {
        url: restApiEndpoint + '/api/project/1/instance/1',
      },
      {
        ...instance,
        pod: {
          status: {
            phase: 'Running',
          },
        },
      }
    );

    cy.get('[data-cy=session-status]').should(
      'have.text',
      'Session Status: Waiting for predictions...'
    );
  });
});
