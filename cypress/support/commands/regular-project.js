const {
  restApiEndpoint,
} = require('../../../app/assets/scripts/config/testing').default;

/**
 * Mock a regular project
 */
Cypress.Commands.add('mockRegularProject', () => {
  cy.intercept(
    {
      host: restApiEndpoint,
      path: '/api/model',
    },
    {
      body: {
        models: [
          {
            id: 1,
            created: '2021-03-09T11:38:37.169Z',
            active: true,
            uid: 1,
            name: 'NAIP Supervised',
            bounds: [null, null, null, null],
          },
        ],
      },
    }
  );

  cy.intercept(
    {
      host: restApiEndpoint,
      path: '/api/project/1',
    },
    {
      body: {
        id: 1,
        name: 'Untitled',
        model_id: 1,
        mosaic: 'naip.latest',
        created: '2021-03-19T12:47:07.838Z',
      },
    }
  );

  cy.intercept(
    {
      host: restApiEndpoint,
      path: '/api/model/1',
    },
    {
      body: {
        id: 1,
        created: '2021-03-09T10:56:35.438Z',
        active: true,
        uid: 1,
        name: 'NAIP Supervised',
        model_type: 'pytorch_example',
        model_inputshape: [256, 256, 4],
        model_zoom: 17,
        storage: true,
        classes: [
          { name: 'No Data', color: '#62a092' },
          { name: 'Water', color: '#0000FF' },
          { name: 'Emergent Wetlands', color: '#008000' },
          { name: 'Tree Canopy', color: '#80FF80' },
          { name: 'Shrubland', color: '#806060' },
          { name: 'Low Vegetation', color: '#07c4c5' },
          { name: 'Barren', color: '#027fdc' },
          { name: 'Structure', color: '#f76f73' },
          { name: 'Impervious Surface', color: '#ffb703' },
          { name: 'Impervious Road', color: '#0218a2' },
        ],
        meta: {},
        bounds: [null, null, null, null],
      },
    }
  );

  cy.intercept(
    {
      host: restApiEndpoint,
      path: '/api/project/1/aoi',
    },
    {
      body: {
        total: 1,
        project_id: 1,
        aois: [
          {
            id: 1,
            name: 'A name',
            created: '2021-03-18T18:42:42.224Z',
            storage: true,
          },
        ],
      },
    }
  );

  cy.intercept(
    {
      host: restApiEndpoint,
      path: '/api/project/1/checkpoint',
    },
    {
      total: 1,
      instance_id: 1,
      checkpoints: [
        {
          id: 1,
          parent: 1,
          name: 'Checkpoint Name',
          storage: true,
          created: '2021-03-18T18:42:42.224Z',
          bookmarked: true,
        },
      ],
    }
  );

  // An instance is running
  cy.intercept(
    {
      host: restApiEndpoint,
      path: '/api/project/1/instance/?status=active',
    },
    {
      total: 1,
      instances: [
        {
          id: 1,
          uid: 123,
          active: true,
          created: '2021-03-18T18:42:42.224Z',
          token: '<instance token>',
        },
      ],
    }
  );

  // Get instance details
  cy.intercept(
    {
      host: restApiEndpoint,
      path: '/api/project/1/instance/1',
    },
    {
      id: 1,
      uid: 123,
      active: true,
      created: '2021-03-18T18:42:42.224Z',
      token: 'fake_token',
    }
  );
});
