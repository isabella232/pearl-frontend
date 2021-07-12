describe('Load existing project', () => {
  beforeEach(() => {
    cy.startServer();
  });

  it('successfully loads', () => {
    cy.fakeLogin();
    cy.mockRegularProject();
    cy.setWsSequence([
      [
        {
          message: 'model#status',
          data: {
            is_aborting: false,
            processing: false,
            aoi: 1,
            checkpoint: 1,
          },
        },
      ],
      [
        {
          message: 'model#checkpoint#progress',
          data: { checkpoint: 1, processed: 0, total: 1 },
        },
        { message: 'model#checkpoint#complete', data: { checkpoint: 1 } },
      ],
    ]);

    cy.visit('/project/1');
    cy.get('[data-cy=session-status]').should(
      'have.text',
      'Session Status: Loading...'
    );
    cy.get('[data-cy=session-status]').should(
      'have.text',
      'Session Status: Ready to go'
    );
    cy.get('[data-cy=global-loading]').should('not.exist');
  });
});
