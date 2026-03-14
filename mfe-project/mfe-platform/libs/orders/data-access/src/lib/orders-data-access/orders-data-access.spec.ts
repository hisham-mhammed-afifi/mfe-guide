import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrdersDataAccess } from './orders-data-access';

describe('OrdersDataAccess', () => {
  let component: OrdersDataAccess;
  let fixture: ComponentFixture<OrdersDataAccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersDataAccess],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersDataAccess);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
