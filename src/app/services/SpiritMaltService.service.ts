// spirit-malt.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MonthlyQuota {
  MonthId: number;
  MonthName: string;
  EALType: string;
  Quantity: number;
}

@Injectable({ providedIn: 'root' })
export class SpiritMaltService {
  private apiUrl = `${environment.apiBaseUrl}/Application`;

  constructor(private http: HttpClient) {}

  getMonthlySpiritMalt(): Observable<MonthlyQuota[]> {
    const token = sessionStorage.getItem('auth_token');
    const headers = new HttpHeaders({
      accept: '*/*',
      Authorization: `Bearer ${token ?? ''}`
    });

    return this.http.get<MonthlyQuota[]>(`${this.apiUrl}/GetMG`, { headers });
  }
}
