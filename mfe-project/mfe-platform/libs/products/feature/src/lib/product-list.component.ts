// libs/products/feature/src/lib/product-list.component.ts
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Product } from '@mfe-platform/shared-models';
import { ProductService } from '@mfe-platform/products-data-access';

@Component({
  selector: 'products-list',
  // Import individual pipes and directives, not CommonModule
  imports: [CurrencyPipe, RouterLink],
  template: `
    <h2>Products</h2>
    <div class="product-grid">
      @for (product of products(); track product.id) {
        <div class="product-card">
          <img [src]="product.thumbnail" [alt]="product.title" />
          <h3>{{ product.title }}</h3>
          <p>{{ product.price | currency }}</p>
          <a [routerLink]="[product.id]">View Details</a>
        </div>
      } @empty {
        <p>Loading products...</p>
      }
    </div>
  `,
  styles: [`
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: var(--spacing-md, 16px);  /* Falls back to 16px if token missing */
    }
    .product-card {
      border: 1px solid #ddd;
      border-radius: var(--border-radius, 8px);
      padding: var(--spacing-md, 16px);
    }
    .product-card img {
      width: 100%;
      height: 180px;
      object-fit: contain;
    }
  `],
})
export class ProductListComponent implements OnInit, OnDestroy {
  private readonly productService = inject(ProductService);

  // signal() is a plain reactive primitive with no DI dependency.
  // We subscribe in ngOnInit, after the component is fully initialized in the correct DI tree.
  readonly products = signal<Product[]>([]);
  private subscription?: Subscription;

  ngOnInit(): void {
    this.subscription = this.productService.getAll().subscribe(p => this.products.set(p));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
