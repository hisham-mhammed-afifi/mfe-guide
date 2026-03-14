import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrdersFeature } from './orders-feature';

describe('OrdersFeature', () => {
  let component: OrdersFeature;
  let fixture: ComponentFixture<OrdersFeature>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersFeature],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersFeature);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
