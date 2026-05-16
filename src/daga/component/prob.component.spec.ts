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
    expect(component.selectedModel).toBe('binomial');

    const binomialComponent = fixture.debugElement.query(By.css('app-risk-simple'));
    expect(binomialComponent).toBeTruthy();

    const binomialButton = fixture.debugElement.query(By.css('[data-test-id="binomial"]'));
    expect(binomialButton.classes['active']).toBe(true);
  });

  it('debe cambiar a la pestaña Bayes al hacer clic y mostrar su componente', () => {
    const bayesButton = fixture.debugElement.query(By.css('[data-test-id="bayes"]'));

    bayesButton.triggerEventHandler('click', null);
    fixture.detectChanges();

    expect(component.selectedModel).toBe('bayes');
    expect(bayesButton.classes['active']).toBe(true);

    const bayesComponent = fixture.debugElement.query(By.css('app-risk-bayes'));
    const binomialComponent = fixture.debugElement.query(By.css('app-risk-simple'));

    expect(bayesComponent).toBeTruthy();
    expect(binomialComponent).toBeFalsy();
  });
});
