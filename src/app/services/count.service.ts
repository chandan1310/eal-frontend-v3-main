// count.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CountService {
  private apiUrl = 'http://localhost:5082/api/Get/adminCounts';
  // private apiUrl = 'http://164.100.150.78/excise/EalBackendApi/api/Get/adminCounts';

  // private apiUrl = 'http://10.132.241.4/excise/EalBackendApi/api/Get/adminCounts';
  // private apiUrl = 'http://10.132.241.27/excise/EalBackendApi/api/Get/adminCounts';


  constructor(private http: HttpClient) { }
s
  getSummaryAdminCounts(params: any = {}): Observable<any> {
    const token = sessionStorage.getItem('auth_token');
    let headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    let httpParams = new HttpParams();
    for (let key in params) {
      if (params[key]) httpParams = httpParams.set(key, params[key]);
    }

    return this.http.get<any>(this.apiUrl, { headers, params: httpParams });
  }

  getUserCounts(): Observable<any> {
    const token = sessionStorage.getItem('auth_token');
    let headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get<any>('http://localhost:5082/api/Get/userCounts', { headers });
    // return this.http.get<any>('http://164.100.150.78/excise/EalBackendApi/api/Get/userCounts', { headers });

    // return this.http.get<any>('http://10.132.241.4/EalBackendApi/api/Get/userCounts', { headers });
    // return this.http.get<any>('http://10.132.241.27/EalBackendApi/api/Get/userCounts', { headers });
  }

}
