// libs/products/data-access/src/lib/product.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs';
import { Product } from '@mfe-platform/shared-models';

// Response wrapper: DummyJSON wraps products in an object
interface ProductsResponse {
  products: Product[];
  total: number;
  skip: number;
  limit: number;
}

// providedIn: 'root' makes this a singleton shared across all MFEs
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://dummyjson.com/products';

  getAll(): Observable<Product[]> {
    return this.http
      .get<ProductsResponse>(this.apiUrl)
      .pipe(map((res) => res.products));
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }
}
