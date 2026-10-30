import { TestBed } from '@angular/core/testing';
import { ReportesService } from './reportes.service';
import { TEST_PROVIDERS } from '../testing/test-providers';

describe('ReportesService', () => {
  let service: ReportesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
        providers: [...TEST_PROVIDERS]
    });
    service = TestBed.inject(ReportesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
