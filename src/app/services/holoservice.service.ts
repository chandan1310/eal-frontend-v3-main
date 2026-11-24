import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class HoloserviceService {
  private apiUrl = `${environment.apiBaseUrl}/login`;
  private menuRefreshSource = new Subject<void>();
  menuRefresh$ = this.menuRefreshSource.asObservable();

  constructor(private http: HttpClient) {}

  triggerMenuRefresh(): void {
    this.menuRefreshSource.next();
  }

  login(username: string, password: string): Observable<any> {
    const headers = new HttpHeaders();
    return this.http.post<any>(
      this.apiUrl,
      { username, password },
      { headers },
    );
  }

  getPOitems(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getTotalApplCount(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}`); //FL total Count(0)
  }

  saveApplFormData(formData: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/save`, formData); // Replace with your actual API endpoint
  }

  saveToken(token: string): void {
    sessionStorage.setItem('auth_token', token);
  }

  // 🔑 ADD THIS METHOD TO FIX THE COMPILER ERROR
  verifyOtp(usernameHash: string, otpCode: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verify-otp`, {
      username: usernameHash,
      otp: otpCode,
    });
  }

  getDynamicMenus(roleId: number) {
    // token lets the API add user-specific pages (e.g. Create Indent for the Section login)
    const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('auth_token') : null;
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
    return this.http.get<any[]>(`${this.apiUrl}/dynamic-menus/${roleId}`, { headers });
  }

  getToken(): string | null {
    return sessionStorage.getItem('auth_token');
  }

  logout(): Observable<any> {
    console.log('loading logout');
    const token = sessionStorage.getItem('auth_token');
    if (!token) {
      console.warn('No auth token found');
    }

    return this.http.post(
      `${environment.apiBaseUrl}/login/logout`,
      {},
      {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
        }),
      },
    );
  }
}