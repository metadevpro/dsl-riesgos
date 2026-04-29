import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleComponent } from './prob.component';
import { By } from '@angular/platform-browser';

describe('SimpleComponent (Pestañas de Modelos)', () => {
  let component: SimpleComponent;
  let fixture: ComponentFixture<SimpleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimpleComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SimpleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe mostrar el modelo Binomial por defecto', () => {
    // Verifica que el estado inicial sea 'binomial'
    expect(component.selectedModel).toBe('binomial');

    // Verifica que se renderiza el componente binomial (selector: app-risk-simple)
    const binomialComponent = fixture.debugElement.query(By.css('app-risk-simple'));
    expect(binomialComponent).toBeTruthy();

    // Verifica que el botón de binomial tiene la clase 'active'
    const binomialButton = fixture.debugElement.queryAll(By.css('.model-item'))[0];
    expect(binomialButton.classes['active']).toBe(true);
  });

  it('debe cambiar a la pestaña Bayes al hacer clic y mostrar su componente', () => {
    // Encuentra los botones de la barra lateral (el tercero es Bayes)
    const buttons = fixture.debugElement.queryAll(By.css('.model-item'));
    const bayesButton = buttons[2];

    // Simula el clic en el botón de Bayes
    bayesButton.triggerEventHandler('click', null);
    fixture.detectChanges();

    // Verifica que el estado cambió
    expect(component.selectedModel).toBe('bayes');

    // Verifica que la clase 'active' está en Bayes
    expect(bayesButton.classes['active']).toBe(true);

    // Verifica que el componente de Bayes está presente y el de Binomial se ocultó
    const bayesComponent = fixture.debugElement.query(By.css('app-risk-bayes'));
    const binomialComponent = fixture.debugElement.query(By.css('app-risk-simple'));

    expect(bayesComponent).toBeTruthy();
    expect(binomialComponent).toBeFalsy();
  });

  it('debe ocultar/mostrar la barra lateral al pulsar el toggle', () => {
    expect(component.isSidebarCollapsed).toBe(false);

    const toggleButton = fixture.debugElement.query(By.css('.sidebar-toggle'));
    toggleButton.triggerEventHandler('click', null);
    fixture.detectChanges();

    expect(component.isSidebarCollapsed).toBe(true);

    const sidebar = fixture.debugElement.query(By.css('.models-sidebar'));
    expect(sidebar.classes['collapsed']).toBe(true);
  });
});
