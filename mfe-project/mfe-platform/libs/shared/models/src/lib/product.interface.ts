// libs/shared/models/src/lib/product.interface.ts
export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
  category: string;
  rating: number;
  stock: number;
}
