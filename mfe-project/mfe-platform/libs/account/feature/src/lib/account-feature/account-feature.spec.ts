import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountFeature } from './account-feature';

describe('AccountFeature', () => {
  let component: AccountFeature;
  let fixture: ComponentFixture<AccountFeature>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountFeature],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountFeature);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
