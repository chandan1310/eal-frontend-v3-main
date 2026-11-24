import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OfficeService {
  private statusUrl = `${environment.apiBaseUrl}/ApplicationStatus/Applications`;
  private selectedOfficeSupplierApplicationSignal = signal<any>(null);
  private url = environment.apiBaseUrl;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('auth_token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private formatDate(value: any): string {
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return d.toISOString().split('T')[0]; // YYYY-MM-DD
    } catch {
      return String(value);
    }
  }

  private buildParams(filters: any): HttpParams {
    let params = new HttpParams();
    if (!filters) return params;

    // Explicit keys with formatting where needed
    if (filters.FinancialYear) params = params.set('FinancialYear', String(filters.FinancialYear));
    if (filters.Month !== null && filters.Month !== undefined && filters.Month !== '') params = params.set('Month', String(filters.Month));
    if (filters.DateFrom) params = params.set('DateFrom', this.formatDate(filters.DateFrom));
    if (filters.DateTo) params = params.set('DateTo', this.formatDate(filters.DateTo));
    if (filters.District) params = params.set('District', String(filters.District));
    if (filters.EALType) params = params.set('EALType', String(filters.EALType));
    if (filters.Search) params = params.set('Search', String(filters.Search));
    if (filters.Status !== null && filters.Status !== undefined && filters.Status !== '') params = params.set('Status', String(filters.Status));
    if (filters.userType) params = params.set('userType', String(filters.userType));
    if (filters.UserType) params = params.set('UserType', String(filters.UserType)); // support backend expecting capitalized key

    // Append any other dynamic filters (avoid duplicates)
    Object.keys(filters).forEach((key) => {
      if (['FinancialYear', 'Month', 'DateFrom', 'DateTo', 'District', 'EALType', 'Search', 'Status', 'userType', 'UserType'].includes(key)) return;
      const val = filters[key];
      if (val !== null && val !== undefined && val !== '') {
        if (key.toLowerCase().includes('date')) {
          params = params.set(key, this.formatDate(val));
        } else {
          params = params.set(key, String(val));
        }
      }
    });

    return params;
  }
  updateApplicationStatus(payload: any): Observable<any> {
    return this.http.post(`${environment.apiBaseUrl}/ApplicationStatus/UpdateStatus`, payload, {
      headers: this.getHeaders()
    });
  }
  // updateApplicationStatus(payload: { AppId: number, Status: number }): Observable<any> {
  //   const token = sessionStorage.getItem('auth_token');
  //   const headers = new HttpHeaders({
  //     Authorization: `Bearer ${token}`,
  //     'Content-Type': 'application/json'
  //   });

  //   return this.http.post(`${environment.apiBaseUrl}/ApplicationStatus/UpdateStatus`, payload, {
  //     headers: headers
  //   });
  // }

  // Fetch all applications (GET) — uses safe params builder
  getAllApplications(filters: any): Observable<any> {
    const headers = this.getHeaders();
    const params = this.buildParams(filters);
    console.log('[OfficeService] getAllApplications params:', params.toString());
    return this.http.get<any>(this.statusUrl, { headers, params });
  }

  // Backwards-compatible method name with same safe behavior
  getApplications(filters: any): Observable<any> {
    const headers = this.getHeaders();
    const params = this.buildParams(filters);
    console.log('[OfficeService] getApplications params:', params.toString());
    return this.http.get<any>(this.statusUrl, { headers, params });
  }
  getHBApplications(filters: any): Observable<any> {
    const headers = this.getHeaders();
    const params = this.buildParams(filters);
    console.log('[OfficeService] getHBApplications params:', params.toString());
    return this.http.get<any>(this.statusUrl, { headers, params });
  }

  setSelectedOfficeSupplierApplication(application: any) {
    this.selectedOfficeSupplierApplicationSignal.set(application);
  }

  get selectedOfficeSupplierApplication() {
    return this.selectedOfficeSupplierApplicationSignal;
  }

  updateOfficeApplication(payload: any) {
    return this.http.post<string[]>(
      `${this.url}/ApplicationStatus/updateOfficeApplication`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  getLabelAssignmentDetailsAPI(filters: any): Observable<any> {
    const headers = this.getHeaders();
    const params = this.buildParams(filters);
    return this.http.get<any>(`${environment.apiBaseUrl}/ApplicationStatus/labelAssignmentDetails`, { headers, params });
  }

  // getWastageDetailsAPI(filters?: any): Observable<any> {
  //   const headers = this.getHeaders();
  //   const params = this.buildParams(filters || {});
  //   return this.http.get<any>(`${environment.apiBaseUrl}/ApplicationStatus/WastageDetails`, { headers, params });
  // }
  // Change this line in office.service.ts
  getWastageDetailsAPI(appNo: string): Observable<any> {
    const headers = this.getHeaders();
    // Ensure the URL exactly matches: /WastageDetails
    return this.http.get<any>(`${environment.apiBaseUrl}/ApplicationStatus/WastageDetails`, {
      headers,
      params: { appNo: appNo }
    });
  }
  createDamageLabel(payload: any): Observable<any> {
    return this.http.post(`${this.url}/ApplicationStatus/CreateDamageLabel`, payload, {
      headers: this.getHeaders()
    });
  }

  getDestroyMaster(filters?: any): Observable<any[]> {
    const headers = this.getHeaders();
    const params = this.buildParams(filters || {});
    return this.http.get<any[]>(`${environment.apiBaseUrl}/ApplicationStatus/DestroyMaster`, { headers, params });
  }

  // createDestroyMaster(formData: FormData): Observable<any> {
  //   const headers = this.getHeaders(); 
  //   return this.http.post(
  //     `${environment.apiBaseUrl}/ApplicationStatus/CreateDestroyMaster`,
  //     formData,
  //     { headers } 
  //   );
  // }

  createDestroyMaster(formData: FormData): Observable<any> {
    // 1. Aapka purana standard headers function call karein (Jo token lekar aata hai)
    let authHeaders = this.getHeaders();

    // 2. CRITICAL FIX: Agar getHeaders() me Content-Type pehle se 'application/json' set hai,
    // toh use delete kar dein taaki browser dynamic multipart boundaries bana sake.
    if (authHeaders.has('Content-Type')) {
      authHeaders = authHeaders.delete('Content-Type');
    }

    // 3. Request pass karein safely bina content-type ke aur token ke saath
    return this.http.post(
      `${environment.apiBaseUrl}/ApplicationStatus/CreateDestroyMaster`,
      formData,
      { headers: authHeaders }
    );
  }

  updateDestroyMaster(payload: FormData): Observable<any> {
    return this.http.post(`${environment.apiBaseUrl}/ApplicationStatus/UpdateDestroyMaster`, payload, {
      headers: new HttpHeaders({
        Authorization: `Bearer ${sessionStorage.getItem('auth_token')}`
      })
    });
  }

  getSpoolAssignmentDetailsAPI(paramsObj: any): Observable<any> {
    const headers = this.getHeaders();
    const params = this.buildParams(paramsObj || {});
    return this.http.get<any>(`${environment.apiBaseUrl}/stock/labelAssignmentSpoolWise`, { headers, params });
  }

  getOfficers(paramsObj?: any): Observable<any> {
    const headers = this.getHeaders();
    const params = this.buildParams(paramsObj || {});
    return this.http.get<any>(`${environment.apiBaseUrl}/ApplicationStatus/officers`, { headers, params });
  }

  // Office Service mein Receiving OTP 
  sendReceivingOtp(payload: any): Observable<any> {
    return this.http.post<any>(`${this.url}/EALReceivingOtp/send-receiving-otp`, payload, {
      headers: this.getHeaders()
    });
  }

  // Verify Receiving OTP API
  verifyReceivingOtp(payload: any): Observable<any> {
    return this.http.post<any>(`${this.url}/EALReceivingOtp/verify-receiving-otp`, payload, {
      headers: this.getHeaders()
    });

  }
  getWastageDetailsFiltered(boxNo: string, monthId: any, financialYear: string, date: string): Observable<any> {
    let params = new HttpParams();
    if (boxNo) params = params.set('appNo', boxNo);
    if (monthId) params = params.set('monthId', monthId);
    if (financialYear) params = params.set('financialYear', financialYear);
    if (date) params = params.set('fromDate', date); // ya agar backend 'date' expect kar raha ho toh 'date' set karein

    return this.http.get(`${this.url}/ApplicationStatus/WastageDetails`, { params, headers: this.getHeaders() });
  }

  createDamageLabelWithFiles(formData: FormData): Observable<any> {
    // apiUrl ki jagah this.url use kiya gaya hai jo class mein already defined hai
    return this.http.post(`${this.url}/ApplicationStatus/CreateDamageLabel`, formData, { headers: this.getHeaders() });
  }
}
