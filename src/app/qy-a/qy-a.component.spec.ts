import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QyAComponent } from './qy-a.component';

describe('QyAComponent', () => {
  let component: QyAComponent;
  let fixture: ComponentFixture<QyAComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QyAComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QyAComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
