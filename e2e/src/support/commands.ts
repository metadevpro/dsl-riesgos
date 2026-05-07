/// <reference types="cypress" />

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Cypress {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Chainable<Subject> {
    login(email: string, password: string): void;
    getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
    dragNodeToCanvas(paletteIndex: number, offsetX: number, offsetY: number): Chainable<void>;
    connectCanvasNodes(srcIdx: number, tgtIdx: number): Chainable<void>;
  }
}

Cypress.Commands.add('login', (email, password) => {
  console.log('Custom command example: Login', email, password);
});

Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-test-id="${testId}"]`);
});

Cypress.Commands.add('dragNodeToCanvas', (paletteIndex: number, offsetX: number, offsetY: number) => {
  cy.get('.daga-palette-view .daga-template-container').eq(paletteIndex).then($el => {
    const elRect = $el[0].getBoundingClientRect();
    const startX = elRect.left + elRect.width / 2;
    const startY = elRect.top + elRect.height / 2;

    cy.get('daga-diagram').then($canvas => {
      const canvasRect = $canvas[0].getBoundingClientRect();
      const targetX = canvasRect.left + offsetX;
      const targetY = canvasRect.top + offsetY;

      // D3 drag v3 uses mouse events (not pointer events).
      // It attaches mousemove/mouseup to event.view (window), so dispatch there.
      cy.window().then(win => {
        $el[0].dispatchEvent(new win.MouseEvent('mousedown', {
          bubbles: true, cancelable: true, button: 0,
          clientX: startX, clientY: startY, view: win
        }));
        win.dispatchEvent(new win.MouseEvent('mousemove', {
          bubbles: true, cancelable: true,
          clientX: targetX, clientY: targetY, view: win
        }));
        win.dispatchEvent(new win.MouseEvent('mouseup', {
          bubbles: true, cancelable: true,
          clientX: targetX, clientY: targetY, view: win
        }));
      });
    });
  });
});

Cypress.Commands.add('connectCanvasNodes', (srcIdx: number, tgtIdx: number) => {
  cy.get('g.diagram-node').eq(srcIdx).then($srcNode => {
    const srcId = $srcNode.attr('id')!;
    cy.get(`#${srcId}_port_3`).then($srcPort => {
      const srcRect = $srcPort[0].getBoundingClientRect();
      const srcX = srcRect.left + srcRect.width / 2;
      const srcY = srcRect.top + srcRect.height / 2;

      cy.get('g.diagram-node').eq(tgtIdx).then($tgtNode => {
        const tgtId = $tgtNode.attr('id')!;
        cy.get(`#${tgtId}_port_1`).then($tgtPort => {
          const tgtRect = $tgtPort[0].getBoundingClientRect();
          const tgtX = tgtRect.left + tgtRect.width / 2;
          const tgtY = tgtRect.top + tgtRect.height / 2;

          cy.window().then(win => {
            // D3 drag v3 uses mouse events attached to event.view (window).
            $srcPort[0].dispatchEvent(new win.MouseEvent('mousedown', {
              bubbles: true, cancelable: true, button: 0,
              clientX: srcX, clientY: srcY, view: win
            }));
            win.dispatchEvent(new win.MouseEvent('mousemove', {
              bubbles: true, cancelable: true,
              clientX: tgtX, clientY: tgtY, view: win
            }));
            // d3.drag resolves target via userHighlight.getFocus(), set only
            // by mouseover on the port SVG element — not by pointer coords.
            $tgtPort[0].dispatchEvent(new win.MouseEvent('mouseover', {
              bubbles: true, cancelable: true,
              clientX: tgtX, clientY: tgtY
            }));
            win.dispatchEvent(new win.MouseEvent('mouseup', {
              bubbles: true, cancelable: true,
              clientX: tgtX, clientY: tgtY, view: win
            }));
          });
        });
      });
    });
  });
});
