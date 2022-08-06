import { TestBed } from '@angular/core/testing';

import { SenseService } from './sense.service';

describe('SenseService', () => {
  let service: SenseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SenseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
