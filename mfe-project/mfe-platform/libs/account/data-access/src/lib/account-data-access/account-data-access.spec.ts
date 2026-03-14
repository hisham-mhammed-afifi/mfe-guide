import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountDataAccess } from './account-data-access';

describe('AccountDataAccess', () => {
  let component: AccountDataAccess;
  let fixture: ComponentFixture<AccountDataAccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountDataAccess],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountDataAccess);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
