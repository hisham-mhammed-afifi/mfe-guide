import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedDataAccessAuth } from './shared-data-access-auth';

describe('SharedDataAccessAuth', () => {
  let component: SharedDataAccessAuth;
  let fixture: ComponentFixture<SharedDataAccessAuth>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedDataAccessAuth],
    }).compileComponents();

    fixture = TestBed.createComponent(SharedDataAccessAuth);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
