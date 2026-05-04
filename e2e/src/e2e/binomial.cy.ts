describe('e2e', () => {
  beforeEach(() => {
    cy.visit('/'); // Se visita la raíz de la aplicación antes de cada prueba
    cy.getByTestId('binomial').click(); // Se hace click en el botón del modelo binomial para asegurarse de que se muestre el panel correspondiente
  });

  it('daga panel should be visible and should have 4 items', () => {
    cy.get('.daga-panel').should('be.visible');
    cy.get('.daga-palette-view').children().should('have.length', 4);
  });
});
