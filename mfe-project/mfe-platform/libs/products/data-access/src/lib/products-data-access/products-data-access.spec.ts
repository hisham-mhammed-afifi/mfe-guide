import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductsDataAccess } from './products-data-access';

describe('ProductsDataAccess', () => {
  let component: ProductsDataAccess;
  let fixture: ComponentFixture<ProductsDataAccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductsDataAccess],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductsDataAccess);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
