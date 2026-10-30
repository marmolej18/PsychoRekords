import { TestBed } from '@angular/core/testing';
import { VentasService } from './ventas.service';
import { TEST_PROVIDERS } from '../testing/test-providers';

describe('VentasService', () => {
  let service: VentasService;

  beforeEach(() => {
    TestBed.configureTestingModule({
        providers: [...TEST_PROVIDERS]
    });
    service = TestBed.inject(VentasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
