import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetallesComponent } from './detalles.component';
import { TEST_PROVIDERS } from '../testing/test-providers';

describe('DetallesComponent', () => {
  let component: DetallesComponent;
  let fixture: ComponentFixture<DetallesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetallesComponent],
      providers: [...TEST_PROVIDERS]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetallesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
