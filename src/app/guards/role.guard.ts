import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router
} from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { isPlatformBrowser } from '@angular/common';
import { isCheckDemandOnlyUser, landingRoute, CHECK_DEMAND_ROUTE } from './landing-route';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  // Routes jo sidebar menu me nahi hote par authenticated users ke liye allowed hone chahiye
  private internalAllowedRoutes: string[] = [
    'home',
    'application-detail',
    'office-application',
    'profile',
    'change-password'
  ];

  constructor(private router: Router, @Inject(PLATFORM_ID) private platformId: Object) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const isBrowser = isPlatformBrowser(this.platformId);
    const token = isBrowser ? sessionStorage.getItem('auth_token') : null;

    if (!token || this.isTokenExpired(token)) {
      if (isBrowser) {
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('allowed_routes');
      }
      this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    try {
      if (isBrowser) {
        const requestedPath = route.routeConfig?.path || '';
        const currentUrl = state.url.split('?')[0];

        const baseRequestedPath = requestedPath.split('/:')[0].toLowerCase().trim();
        const cleanUrl = currentUrl.replace(/^\/+/, '').toLowerCase();
        const baseCleanUrl = cleanUrl.split('/')[0];

        // 1. Whitelist check (Home aur application-detail jaisi internal screens hamesha allow rahengi)
        const isInternalWhitelisted = this.internalAllowedRoutes.some(internal => 
          baseRequestedPath === internal || 
          baseCleanUrl === internal ||
          cleanUrl.startsWith(internal)
        );

        // Approval-level officers: Home is not theirs – send them to Check Demand Raise
        if ((baseRequestedPath === 'home' || baseCleanUrl === 'home') && isCheckDemandOnlyUser()) {
          this.router.navigate(['/' + CHECK_DEMAND_ROUTE]);
          return false;
        }

        if (isInternalWhitelisted) {
          return true;
        }

        // 2. Dynamic permission check from sessionStorage
        const allowedRoutesStr = sessionStorage.getItem('allowed_routes');
        if (allowedRoutesStr) {
          const rawAllowedRoutes: string[] = JSON.parse(allowedRoutesStr);
          
          const allowedRoutes = rawAllowedRoutes.map(r => 
            (r || '').trim().toLowerCase().replace(/^\/+/, '')
          );

          const isAllowed = allowedRoutes.some(allowed => {
            const cleanAllowed = allowed.replace(/^\/+/, '');
            const baseAllowed = cleanAllowed.split('/:')[0].split('/')[0];

            return (
              cleanAllowed === requestedPath.toLowerCase() ||
              cleanAllowed === baseRequestedPath ||
              cleanAllowed === cleanUrl ||
              baseAllowed === baseRequestedPath ||
              baseAllowed === baseCleanUrl ||
              (baseRequestedPath.includes('office') && cleanAllowed.includes('office'))
            );
          });

          if (isAllowed) {
            return true;
          }
        }
      }

      console.warn(`[RoleGuard] Access blocked for route: ${state.url}`);
      this.router.navigate([landingRoute()]);
      return false;

    } catch (error) {
      console.error('Guard Error:', error);
      this.router.navigate([landingRoute()]);
      return false;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const decodedToken: any = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      return decodedToken.exp < currentTime;
    } catch {
      return true;
    }
  }
}
