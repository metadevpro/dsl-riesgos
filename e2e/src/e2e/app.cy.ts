

describe('e2e', () => {
  beforeEach(() => cy.visit('/')); //Se visita la raíz de la aplicación antes de cada prueba

  it('daga panel should exist', () => {
    cy.get('.daga-panel').should('exist');
  });

  it('should display 3 tabs', () => {
    cy.getByTestId('sidebar').find('button').should('have.length', 3);
  });
});
