// libs/products/feature/src/lib/product-detail.component.ts
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { switchMap, of, Subscription } from 'rxjs';
import { Product } from '@mfe-platform/shared-models';
import { ProductService } from '@mfe-platform/products-data-access';

@Component({
  selector: 'products-detail',
  imports: [CurrencyPipe],
  template: `
    @if (product(); as p) {
      <img [src]="p.thumbnail" [alt]="p.title" style="max-width:300px;" />
      <h2>{{ p.title }}</h2>
      <p>{{ p.description }}</p>
      <p class="price">{{ p.price | currency }}</p>
      <p>Category: {{ p.category }} | Rating: {{ p.rating }}/5 | Stock: {{ p.stock }}</p>
    } @else {
      <p>Loading...</p>
    }
  `,
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);

  // signal() + ngOnInit avoids NG0203 in Module Federation remotes.
  // See the MFE Gotcha note in Step 3 above.
  readonly product = signal<Product | null>(null);
  private subscription?: Subscription;

  ngOnInit(): void {
    this.subscription = this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id');
        return id ? this.productService.getById(Number(id)) : of(null);
      })
    ).subscribe(p => this.product.set(p));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
