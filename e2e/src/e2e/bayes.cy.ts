describe('e2e', () => {
  beforeEach(() => {
    cy.visit('/'); // Se visita la raíz de la aplicación antes de cada prueba
    cy.getByTestId('bayes').click(); // Se hace click en el botón del modelo binomial para asegurarse de que se muestre el panel correspondiente
  });

  it('daga panel should be visible and should have 1 item', () => {
    cy.get('.daga-panel').should('be.visible');
    cy.get('.daga-palette-view').children().should('have.length', 1);
  });

  it('daga model should be visible', () => {
    cy.get('app-risk-bayes').should('be.visible');
  });

  it('daga diagram should be visible', () => {
    cy.get('daga-diagram').should('be.visible');
  });

  it('should build bayes network and run Monte Carlo', () => {
    // Drag 2 nodes: second is 200px gap after first (200px wide → placed at x=500)
    cy.dragNodeToCanvas(0, 100, 200); // Node 1
    cy.dragNodeToCanvas(0, 400, 200); // Node 2

    // Connect Node 1 right port → Node 2 left port (200×100 nodes)
    cy.connectCanvasNodes(0, 1);

    // Open CPT popup for Node 1 (root): right-click to select, Esc to dismiss context menu,
    // then double-click the property name in the property editor to open the popup.
    cy.get('g.diagram-node').eq(0).rightclick({ force: true });
    cy.get('body').type('{esc}');
    cy.get('daga-property-editor .daga-property-name').dblclick({ force: true });
    cy.get('.bayes-popup-backdrop').should('be.visible');
    cy.get('.bayes-popup-backdrop table input[type="number"]').eq(0)
      .clear().type('70').trigger('change'); // Sí = 70
    cy.get('.bayes-popup-backdrop table input[type="number"]').eq(1)
      .clear().type('30').trigger('change'); // No = 30
    // Close popup by clicking the backdrop corner (outside centered dialog)
    cy.get('.bayes-popup-backdrop').click('topLeft', { force: true });
    cy.get('.bayes-popup-backdrop').should('not.exist');

    // Open CPT popup for Node 2 (child): same pattern — right-click to select,
    // Esc to dismiss context menu, double-click property name to open popup.
    cy.get('g.diagram-node').eq(1).rightclick({ force: true });
    cy.get('body').type('{esc}');
    cy.get('daga-property-editor .daga-property-name').dblclick({ force: true });
    cy.get('.bayes-popup-backdrop').should('be.visible');
    // First row (parent=Sí): P(Sí)=10, P(No)=90
    cy.get('.bayes-popup-backdrop table input[type="number"]').eq(0)
      .clear().type('10').trigger('change');
    cy.get('.bayes-popup-backdrop table input[type="number"]').eq(1)
      .clear().type('90').trigger('change');
    cy.get('.bayes-popup-backdrop').click('topLeft', { force: true });
    cy.get('.bayes-popup-backdrop').should('not.exist');

    // Open Monte Carlo panel and execute
    cy.contains('button', 'Monte Carlo').click();
    cy.get('#mcIteracionesInput').should('be.visible');
    cy.contains('button', 'Ejecutar').click();

    // Results table should appear in the MC panel
    cy.get('#mcIteracionesInput').parents('div').first().parent().find('table').should('exist');
  });
});