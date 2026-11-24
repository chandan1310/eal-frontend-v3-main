import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root'
})
export class UserTypeGuard implements CanActivate {

  constructor(private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const token: any = sessionStorage.getItem('auth_token');

    if (!token || this.isTokenExpired(token)) {
      sessionStorage.removeItem('auth_token');
      this.router.navigate(['/login']);
      return false;
    }

    try {
      const decodedToken: any = jwtDecode(token);
      const userType = decodedToken.UserType;
      const requiredRole = route.data['role'];

      // Redirect based on UserType and required role
      switch (userType) {
        case 'FL':
          this.router.navigate(['/fl']);
          break;
        case 'CL':
          this.router.navigate(['/cl']);
          break;
        case 'CLFL':
          this.router.navigate(['/clfl']);
          break;
        // case 'Bar':
        //   this.router.navigate(['/Bar']);
        //   break;
        default:
          this.router.navigate(['/home']); // fallback
      }

      // Allow 'CLFL' to access both 'CL' and 'FL' routes
      if (userType === 'CLFL' && (requiredRole === 'CL' || requiredRole === 'FL')) {
        return true;
      }

      // Normal check for single role
      if (Array.isArray(requiredRole)) {
        if (requiredRole.includes(userType)) return true;
      } else if (userType === requiredRole) {
        return true;
      }
    } catch (error) {
      console.error('Invalid Token:', error);
    }

    this.router.navigate(['/home']);
    return false;
  }

  private isTokenExpired(token: string): boolean {
    const decodedToken: any = jwtDecode(token);
    const currentTime = Math.floor(Date.now() / 1000);
    return decodedToken.exp < currentTime;
  }
}
