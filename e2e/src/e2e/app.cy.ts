

describe('e2e', () => {
  beforeEach(() => cy.visit('/')); //Se visita la raíz de la aplicación antes de cada prueba

  it('daga panel should be visible', () => {
    cy.get('.daga-panel').should('be.visible');
  });

  it('should display 3 tabs', () => {
    cy.getByTestId('sidebar').find('button').should('have.length', 3);
  });
});
