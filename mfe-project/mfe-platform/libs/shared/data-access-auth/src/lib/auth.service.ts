// libs/shared/data-access-auth/src/lib/auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { User, LoginRequest } from '@mfe-platform/shared-models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  // Writable signal: only this service can update it
  private readonly currentUser = signal<User | null>(null);

  /** Read-only signal for consuming components */
  readonly user = this.currentUser.asReadonly();

  /** Computed convenience signal: true when a user is logged in */
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  login(credentials: LoginRequest): Observable<User> {
    return this.http
      .post<User>('https://dummyjson.com/auth/login', credentials)
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  logout(): void {
    this.currentUser.set(null);
  }
}
