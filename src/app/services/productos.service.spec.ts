import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ProductosService, urlPortada } from './productos.service';
import { TEST_PROVIDERS } from '../testing/test-providers';

describe('ProductosService', () => {
  let service: ProductosService;

  beforeEach(() => {
    TestBed.configureTestingModule({
        providers: [...TEST_PROVIDERS]
    });
    service = TestBed.inject(ProductosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('urlPortada usa la portada subida y, si no hay, la imagen por título', () => {
    expect(urlPortada({ titulo: 'Thriller', imagen_url: '/uploads/portadas/abc.png' }))
      .toBe('http://localhost:3000/uploads/portadas/abc.png');
    expect(urlPortada({ titulo: 'Thriller', imagen_url: null })).toBe('/Thriller.jpg');
    expect(urlPortada({ titulo: 'Thriller' })).toBe('/Thriller.jpg');
  });

  it('subirImagen envía el archivo como formulario al disco indicado', () => {
    const http = TestBed.inject(HttpTestingController);
    const archivo = new File(['x'], 'portada.png', { type: 'image/png' });

    service.subirImagen(5, archivo).subscribe();

    const peticion = http.expectOne('http://localhost:3000/api/productos/5/imagen');
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body instanceof FormData).toBeTrue();
    expect((peticion.request.body as FormData).get('imagen')).toBe(archivo);
    expect(peticion.request.headers.has('Content-Type')).toBeFalse();
    http.verify();
  });
});
