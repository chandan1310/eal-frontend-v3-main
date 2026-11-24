


// auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { LoginService } from '../services/login.service';
import { jwtDecode } from 'jwt-decode';
import { landingRoute } from './landing-route';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private loginService: LoginService, private router: Router) {}

  canActivate(): boolean {
    if (this.loginService.isLoggedIn()) {
      this.router.navigate([landingRoute()]); // Redirect logged-in users to their landing page
      return false;
    }
    return true; // Allow access if not logged in
  }

  // Check if the token is expired
  private isTokenExpired(): boolean {
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      const decodedToken: any = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
      return decodedToken.exp < currentTime;
    }
    return true;
  }
}
