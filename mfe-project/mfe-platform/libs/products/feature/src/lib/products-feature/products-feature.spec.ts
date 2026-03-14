import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductsFeature } from './products-feature';

describe('ProductsFeature', () => {
  let component: ProductsFeature;
  let fixture: ComponentFixture<ProductsFeature>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductsFeature],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductsFeature);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
