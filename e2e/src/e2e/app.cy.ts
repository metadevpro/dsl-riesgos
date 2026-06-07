describe('e2e', () => {
  beforeEach(() => cy.visit('/')); // Se visita la raíz de la aplicación antes de cada prueba

  it('header should display the 4 sections', () => {
    cy.get('header nav a').should('have.length', 4);
    cy.getByTestId('nav-home').should('be.visible');
    cy.getByTestId('nav-binomial').should('be.visible');
    cy.getByTestId('nav-bayes').should('be.visible');
    cy.getByTestId('nav-doc').should('be.visible');
  });

  it('landing page should be visible', () => {
    cy.get('.landing').should('be.visible');
  });
});
