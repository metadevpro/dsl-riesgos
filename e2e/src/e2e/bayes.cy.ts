describe('e2e', () => {
  beforeEach(() => {
    cy.visit('/'); // Se visita la raíz de la aplicación antes de cada prueba
    cy.get('header nav a').should('have.length', 4); // El header con las 4 secciones debe estar visible
    cy.getByTestId('nav-bayes').click(); // Se navega a la sección bayes mediante el enlace del header
  });

  it('toolbar should show import, export, import-csv, generate-csv and monte-carlo', () => {
    cy.getByTestId('import').should('be.visible');
    cy.getByTestId('export').should('be.visible');
    cy.getByTestId('import-csv').should('be.visible');
    cy.getByTestId('generate-csv').should('be.visible');
    cy.getByTestId('monte-carlo').should('be.visible');
  });

  it('daga panel should be visible and should have 3 items', () => {
    cy.get('.daga-panel').should('be.visible');
    cy.get('.daga-palette-view').children().should('have.length', 3);
  });

  it('daga model should be visible', () => {
    cy.get('risk-bayes').should('be.visible');
  });

  it('daga diagram should be visible', () => {
    cy.get('daga-diagram').should('be.visible');
  });

  it('should build bayes network and run Monte Carlo', () => {
    // Drag 2 nodes onto canvas (250×150 nodes, 150px gap between centers).
    cy.dragNodeToCanvas(0, 300, 200); // Node 1
    cy.dragNodeToCanvas(1, 500, 200); // Node 2

    // Connect Node 1 right port → Node 2 left port.
    cy.connectCanvasNodes(0, 1);

    // Open CPT popup for Node 1 (root): right-click to select, Esc to dismiss context menu,
    // then double-click the property name in the property editor to open the popup.
    cy.get('g.diagram-node').eq(0).rightclick({ force: true });
    cy.get('body').type('{esc}');
    cy.get('daga-property-editor .daga-property-name').dblclick({ force: true });
    cy.get('.bayes-popup-backdrop').should('be.visible');
    cy.get('.bayes-popup-backdrop table input[type="number"]').eq(0).clear().type('70').trigger('change'); // Sí = 70
    cy.get('.bayes-popup-backdrop table input[type="number"]').eq(1).clear().type('30').trigger('change'); // No = 30
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
    cy.get('.bayes-popup-backdrop table input[type="number"]').eq(0).clear().type('10').trigger('change');
    cy.get('.bayes-popup-backdrop table input[type="number"]').eq(1).clear().type('90').trigger('change');
    cy.get('.bayes-popup-backdrop').click('topLeft', { force: true });
    cy.get('.bayes-popup-backdrop').should('not.exist');

    // Open Monte Carlo panel and execute
    cy.getByTestId('monte-carlo').click();
    cy.get('#mcIteracionesInput').should('be.visible');
    cy.contains('button', 'Run').click();

    // Results table should appear in the MC panel
    cy.get('#mcIteracionesInput').parents('div').first().parent().find('table').should('exist');
  });
});
