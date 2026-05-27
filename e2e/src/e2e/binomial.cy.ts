describe('e2e', () => {
  beforeEach(() => {
    cy.visit('/'); // Se visita la raíz de la aplicación antes de cada prueba
    cy.getByTestId('binomial').click(); // Se hace click en el botón del modelo binomial para asegurarse de que se muestre el panel correspondiente
  });

  it('daga panel should be visible and should have 4 items', () => {
    cy.get('.daga-panel').should('be.visible');
    cy.get('.daga-palette-view').children().should('have.length', 4);
  });

  it('daga model should be visible', () => {
    cy.get('app-risk-simple').should('be.visible');
  });

  it('daga diagram should be visible', () => {
    cy.get('daga-diagram').should('be.visible');
  });

  it('results panel should not be visible initially', () => {
    cy.getByTestId('results-panel').should('not.be.visible');
  });

  it('should build diagram and run binomial calculation', () => {
    // Drag 4 nodes to canvas (50px grid → positions are multiples of 200)
    cy.dragNodeToCanvas(0, 300, 200); // Start
    cy.dragNodeToCanvas(1, 500, 200); // Estado
    cy.dragNodeToCanvas(2, 700, 200); // Suceso
    cy.dragNodeToCanvas(3, 900, 200); // End

    // Connect: right port of each node → left port of next (150×50 nodes)
    cy.connectCanvasNodes(0, 1); // Start → Estado
    cy.connectCanvasNodes(1, 2); // Estado → Suceso
    cy.connectCanvasNodes(2, 3); // Suceso → End

    // Right-click Suceso node (index 2) to select it, dismiss any context menu
    cy.get('g.diagram-node').eq(2).rightclick({ force: true });
    cy.get('body').type('{esc}');

    // Set probability = 50 in the property editor (top-right panel)
    cy.get('daga-property-editor .daga-property-name')
      .contains('probability')
      .closest('.daga-property')
      .find('input[type="number"]')
      .clear()
      .type('50')
      .trigger('change');
    
    cy.get('daga-diagram').click();
    // Open calculation dialog, set 1000 iterations, run
    cy.get('.topbar-actions').contains('button', 'Calculate Probability').click();
    cy.get('#iterations').type('1000');
    // The "Calculate" button that only has "Calculate" text (not "Calculate Probability") is the one inside the dialog
    cy.contains('button', /^\s*Calculate\s*$/).click();

    // pushResult() auto-calls openResultsBar() → panel slides in
    cy.getByTestId('results-panel').should('be.visible');
  });
});
