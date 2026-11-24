import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { LoginService } from './login.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RoleManagementService {
  private baseUrl = `${environment.apiBaseUrl}/RoleManagement`;

  constructor(
    private http: HttpClient,
    private loginService: LoginService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private getHeaders(): HttpHeaders {
    let token = this.loginService.getToken() || '';
    if (!token && isPlatformBrowser(this.platformId)) {
      token = sessionStorage.getItem('auth_token') || '';
    }
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getLookups(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/lookups`, { headers: this.getHeaders() });
  }

  getRoles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/roles`, { headers: this.getHeaders() });
  }

  saveRole(role: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/roles`, role, { headers: this.getHeaders() });
  }

  deleteRole(roleId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/roles/${roleId}`, { headers: this.getHeaders() });
  }

  getPages(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/pages`, { headers: this.getHeaders() });
  }

  savePage(page: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/pages`, page, { headers: this.getHeaders() });
  }

  deletePage(pageId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/pages/${pageId}`, { headers: this.getHeaders() });
  }

  getRolePages(roleId: number): Observable<number[]> {
    return this.http.get<number[]>(`${this.baseUrl}/role-pages/${roleId}`, { headers: this.getHeaders() });
  }

  assignPages(payload: { roleId: number; pageIds: number[]; financialYear?: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/assign-pages`, payload, { headers: this.getHeaders() });
  }

  getSuppliers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/suppliers`, { headers: this.getHeaders() });
  }

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/users`, { headers: this.getHeaders() });
  }

  createUser(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/create-user`, payload, { headers: this.getHeaders() });
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/users/${userId}`, { headers: this.getHeaders() });
  }

  updateUserRole(payload: { userId: number; roleId: number }): Observable<any> {
    return this.http.put(`${this.baseUrl}/update-user-role`, payload, { headers: this.getHeaders() });
  }

  toggleUserStatus(userId: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/toggle-user-status/${userId}`, {}, { headers: this.getHeaders() });
  }

  resetUserPassword(payload: { userId: number; newPassword: string }): Observable<any> {
    return this.http.put(`${this.baseUrl}/reset-password`, payload, { headers: this.getHeaders() });
  }
}