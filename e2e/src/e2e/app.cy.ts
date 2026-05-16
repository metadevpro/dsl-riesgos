describe('e2e', () => {
  beforeEach(() => cy.visit('/')); //Se visita la raíz de la aplicación antes de cada prueba

  it('daga panel should be visible', () => {
    cy.get('.daga-panel').should('be.visible');
  });

  it('should display model tabs in the topbar', () => {
    cy.get('.app-topbar .topbar-tabs button').should('have.length', 2);
    cy.getByTestId('binomial').should('be.visible');
    cy.getByTestId('bayes').should('be.visible');
  });
});
