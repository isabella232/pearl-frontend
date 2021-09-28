const {
  auth0Domain,
  restApiEndpoint,
} = require('../../app/assets/scripts/config/testing').default;

describe('The app header', () => {
  beforeEach(() => {
    cy.startServer();
  });

  it('shows the account button when logged in', () => {
    cy.fakeLogin();
    cy.visit('/');
    cy.get('body');
    cy.get('[data-cy=account-button]').should('exist');
    cy.get('[data-cy=login-button]').should('not.exist');
  });

  it('/project/new is protected', () => {
    cy.visit('/project/new');
    cy.location().should((loc) => {
      expect(loc.host).to.include(auth0Domain);
    });
  });

  it('/project/:id is protected', () => {
    cy.visit('/project/1');
    cy.location().should((loc) => {
      expect(loc.host).to.include(auth0Domain);
    });
  });

  it('/profile/maps is protected', () => {
    cy.visit('/profile/maps');
    cy.location().should((loc) => {
      expect(loc.host).to.include(auth0Domain);
    });
  });

  it('/profile/projects is protected', () => {
    cy.visit('/profile/projects');
    cy.location().should((loc) => {
      expect(loc.host).to.include(auth0Domain);
    });
  });

  it('/profile/projects/:id is protected', () => {
    cy.visit('/profile/projects/:1');
    cy.location().should((loc) => {
      expect(loc.host).to.include(auth0Domain);
    });
  });

  it('when a generic 401 status happens, redirect to login', () => {
    cy.intercept(
      {
        url: restApiEndpoint + '/api/*',
      },
      (req) => {
        req.reply(401, {
          status: 401,
          message: 'Authentication Required',
          messages: [],
        });
      }
    );

    cy.visit('/project/1');

    cy.location().should((loc) => {
      expect(loc.host).to.include(auth0Domain);
    });
  });
});
