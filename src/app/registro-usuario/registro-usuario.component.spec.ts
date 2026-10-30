import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistroUsuarioComponent } from './registro-usuario.component';
import { TEST_PROVIDERS } from '../testing/test-providers';

describe('RegistroUsuarioComponent', () => {
  let component: RegistroUsuarioComponent;
  let fixture: ComponentFixture<RegistroUsuarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistroUsuarioComponent],
      providers: [...TEST_PROVIDERS]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistroUsuarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
