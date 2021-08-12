const {
  restApiEndpoint,
} = require('../../../app/assets/scripts/config/testing').default;

describe('Instance status', () => {
  beforeEach(() => {
    cy.startServer();
  });

  it('New project', () => {
    cy.fakeLogin();
    cy.mockRegularProject();

    cy.visit('/project/new');

    cy.get('[data-cy=session-status]').should(
      'have.text',
      'Session Status: Waiting for model run'
    );

    // Set project name
    cy.get('[data-cy=modal-project-input]').type('Project name');
    cy.get('[data-cy=create-project-button]').should('exist').click();

    // Set AOI
    cy.get('[data-cy=aoi-edit-button]').click();
    cy.get('#map')
      .trigger('mousedown', 150, 150)
      .trigger('mousemove', 200, 200)
      .trigger('mouseup');
    cy.wait('@reverseGeocodeCity');

    // Set model
    cy.get('[data-cy=select-model-label]').should('exist').click();
    cy.get('[data-cy=select-model-1-card]').should('exist').click();

    // Set no instances available
    cy.intercept(
      {
        url: restApiEndpoint + '/api',
      },
      {
        version: '1.0.0',
        limits: {
          live_inference: 10000000,
          max_inference: 100000000,
          instance_window: 600,
          total_gpus: 15,
          active_gpus: 15,
        },
      }
    ).as('fetchAvailableInstancesCount');

    // Request model run
    cy.get('[data-cy=run-button').click();

    // Wait for outbound request
    cy.wait('@fetchAvailableInstancesCount');

    // Should display modal
    cy.get('#run-model-error')
      .should(
        'contain',
        'No instance available to run the model, please try again later.'
      )
      .click();

    // Set no instances available
    cy.intercept(
      {
        url: restApiEndpoint + '/api',
      },
      {
        version: '1.0.0',
        limits: {
          live_inference: 10000000,
          max_inference: 100000000,
          instance_window: 600,
          total_gpus: 15,
          active_gpus: 5,
        },
      }
    ).as('fetchAvailableInstancesCount');

    // Request model run
    cy.get('[data-cy=run-button').click();

    // Wait for outbound request
    cy.wait('@fetchAvailableInstancesCount');

    cy.get('#run-model-error').should('not.exist');

    // Change status
    cy.get('[data-cy=session-status]').should(
      'have.text',
      'Session Status: Waiting for model run'
    );
  });

  it('Project exists, active instance, running');

  it('Project exists, active instance, scheduled');

  it('Project exists, active instance, failed');
});
