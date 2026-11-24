import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InventarioComponent } from './inventario.component';
import { TEST_PROVIDERS } from '../testing/test-providers';

describe('InventarioComponent', () => {
  let component: InventarioComponent;
  let fixture: ComponentFixture<InventarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventarioComponent],
      providers: [...TEST_PROVIDERS]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InventarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('portada', () => {
    const elegir = (archivo: File) => {
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { value: [archivo] });
      component.onPortadaSeleccionada({ target: input } as unknown as Event);
    };

    it('acepta JPG, PNG o WEBP de hasta 2 MB y muestra la vista previa', () => {
      elegir(new File(['x'], 'portada.png', { type: 'image/png' }));
      expect(component.archivoPortada?.name).toBe('portada.png');
      expect(component.vistaPrevia).toMatch(/^blob:/);
      expect(component.errorPortada).toBe('');
    });

    it('rechaza otros tipos de archivo', () => {
      elegir(new File(['x'], 'documento.pdf', { type: 'application/pdf' }));
      expect(component.archivoPortada).toBeNull();
      expect(component.errorPortada).toContain('JPG, PNG o WEBP');
    });

    it('rechaza imágenes de más de 2 MB', () => {
      elegir(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.jpg', { type: 'image/jpeg' }));
      expect(component.archivoPortada).toBeNull();
      expect(component.errorPortada).toContain('2 MB');
    });
  });
});
