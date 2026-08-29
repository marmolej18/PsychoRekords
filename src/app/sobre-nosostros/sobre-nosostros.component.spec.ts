import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SobreNosostrosComponent } from './sobre-nosostros.component';

describe('SobreNosostrosComponent', () => {
  let component: SobreNosostrosComponent;
  let fixture: ComponentFixture<SobreNosostrosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SobreNosostrosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SobreNosostrosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
