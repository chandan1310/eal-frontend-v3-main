import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class LoginService {

  private baseUrl = 'http://localhost:5082/api';
  // private baseUrl = 'http://164.100.150.78/excise/EalBackendApi/api';

  // private baseUrl = 'http://10.132.241.27/excise/EalBackendApi/api'; 

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  // Login API
  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}`, { username, password });
  }

  // Check if token exists in sessionStorage
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // Get token from sessionStorage
  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return sessionStorage.getItem('auth_token');
    }
    return null;
  }

  // Save token
  saveToken(token: string): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem('auth_token', token);
    }
  }

  // Logout user
  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem('auth_token');
    }
  }

  // Token blacklist check
  checkToken(): Observable<any> {
    const token = sessionStorage.getItem('auth_token');
    let headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.get(`${this.baseUrl}/get/check-token`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}





// import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
// import { HttpClient } from '@angular/common/http';
// import { Observable } from 'rxjs';
// import { isPlatformBrowser } from '@angular/common';

// @Injectable({
//   providedIn: 'root'
// })
// export class LoginService {
//   constructor(
//     private http: HttpClient,
//     @Inject(PLATFORM_ID) private platformId: Object
//   ) {}

//   apiUrl11!: string;

//   login(id1: string, pwd1: string): Observable<any[]> {
//     this.apiUrl11 = `http://10.132.241.4/exciseNewApi/GetPOListCL?FinYear=2024-2025&Remark=CmpltDetailsCL&status=${pwd1}&wrid=${id1}`;
//     return this.http.get<any[]>(this.apiUrl11);
//   }

//   isLoggedIn(): boolean {
//     if (isPlatformBrowser(this.platformId)) {
//       return !!sessionStorage.getItem('auth_token');
//     }
//     return false;
//   }
// }
