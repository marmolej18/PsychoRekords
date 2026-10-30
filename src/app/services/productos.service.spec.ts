import { TestBed } from '@angular/core/testing';
import { ProductosService } from './productos.service';
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
});
