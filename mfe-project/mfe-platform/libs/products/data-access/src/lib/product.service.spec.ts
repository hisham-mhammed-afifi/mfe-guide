// libs/products/data-access/src/lib/product.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ProductService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify(); // Ensure no outstanding requests
  });

  it('should fetch all products', () => {
    const mockProducts = [
      { id: 1, title: 'Widget', description: 'A widget', price: 9.99, thumbnail: '', category: 'test', rating: 4.5, stock: 10 },
    ];

    service.getAll().subscribe((products) => {
      expect(products).toEqual(mockProducts);
    });

    const req = httpTesting.expectOne('https://dummyjson.com/products');
    expect(req.request.method).toBe('GET');
    // DummyJSON wraps products in an object; the service extracts .products
    req.flush({ products: mockProducts, total: 1, skip: 0, limit: 30 });
  });

  it('should fetch a product by ID', () => {
    const mockProduct = {
      id: 1, title: 'Widget', description: 'A widget', price: 9.99, thumbnail: '', category: 'test', rating: 4.5, stock: 10,
    };

    service.getById(1).subscribe((product) => {
      expect(product).toEqual(mockProduct);
    });

    const req = httpTesting.expectOne('https://dummyjson.com/products/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockProduct);
  });
});
