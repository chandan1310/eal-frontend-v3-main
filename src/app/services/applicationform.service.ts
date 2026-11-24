import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApplicationformService {

  // private applicationUrl = 'http://localhost:5082/api';
  private applicationUrl = environment.apiBaseUrl;

  private selectedSupplierApplicationSignal = signal<{ mode: 'view' | 'edit'; data: any }>({
    mode: 'view',
    data: {},
  });

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('auth_token');
    // const token = localStorage.getItem('token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  saveApplication(payload: any): Observable<any> {
    const token = sessionStorage.getItem('auth_token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post<any>(
      `${this.applicationUrl}/Application/createFlApplication`,
      payload,
      {
        headers,
        reportProgress: true,
        observe: 'response',
      }
    );
  }
  saveClApplication(payload: any): Observable<any> {
    const token = sessionStorage.getItem('auth_token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post<any>(
      `${this.applicationUrl}/Application/createClApplication`,
      payload,
      {
        headers,
        reportProgress: true,
        observe: 'response',
      }
    );
  }
  saveBarApplication(payload: any): Observable<any> {
    const token = sessionStorage.getItem('auth_token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post<any>(
      `${this.applicationUrl}/Application/createBarApplication`,
      payload,
      {
        headers,
        reportProgress: true,
        observe: 'response',
      }
    );
  }
  reSubmitApplication(data: FormData): Observable<any> {
    const token = sessionStorage.getItem('auth_token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post<any>(
      `${this.applicationUrl}/Application/reSubmitApplication`,
      data,
      {
        headers,
        reportProgress: true,
        observe: 'response',
      }
    );
  }


  // getSupplierAppicationHistoryDetails(filters: any): Observable<string[]> {
  //   return this.http.get<string[]>(`${this.applicationUrl}/Application/applicationHistory`, {
  //     params: filters,
  //     headers: this.getHeaders(),
  //   });
  // }

  applicationHistoryByYear(filters: any): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.applicationUrl}/Application/applicationHistoryByYear`, 
      {
        params: filters,
        headers: this.getHeaders(),
      }
    );
  }
  getSupplierBarApplicationHistoryDetails(filters: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.applicationUrl}/Application/barapplication-history`, {
      params: filters,
      headers: this.getHeaders(),
    });
  }

  getStatusMasters(): Observable<string[]> {
    return this.http.get<string[]>(`${this.applicationUrl}/get/allMasterStatus`, {
      headers: this.getHeaders(),
    });
  }
  getDesignations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.applicationUrl}/ApplicationStatus/officers`, {
      headers: this.getHeaders()
    });
  }

  setSelectedSupplierApplication(mode, application: any) {
    this.selectedSupplierApplicationSignal.set({ mode: mode, data: application });

  }

  get selectedSupplierApplication() {
    return this.selectedSupplierApplicationSignal;
  }
  getApplicationHistory(financialYear: string, status: string) {
    let params: any = {
      FinancialYear: financialYear
    };

    if (status && status !== 'All') {
      params.Status = status;
    }

    return this.http.get<any>(
      `${this.applicationUrl}/Application/applicationHistory`,
      { params: params }
    );
  }
  getFinancialYearList() {
    return this.http.get<string[]>(`${this.applicationUrl}/Application/GetFinancialYears`);
  }


  /* ===================== DOWNLOAD APPLICATION PDF ===================== */

  downloadApplicationPdf(appId: number): Observable<Blob> {
    return this.http.get(
      `${this.applicationUrl}/Application/downloadApplicationPdf/${appId}`,
      {
        responseType: 'blob'
      }
    );
  }

  /* ===================== DOWNLOAD PERMIT PDF ===================== */

  downloadPermitPdf(appId: number): Observable<Blob> {
    return this.http.get(
      `${this.applicationUrl}/Application/downloadPermitPdf/${appId}`,
      {
        responseType: 'blob'
      }
    );
  }
  //  /** 📄 Download HB Application PDF */
  //   downloadApplicationPdf(appId: number): Observable<Blob> {
  //     return this.http.get(
  //       `${this.applicationUrl}/downloadApplicationPdf/${appId}`,
  //       { responseType: 'blob' }
  //     );
  //   }

  //   /** 📜 Download HB Permit PDF */
  //   downloadPermitPdf(appId: number): Observable<Blob> {
  //     return this.http.get(
  //       `${this.applicationUrl}/downloadPermitPdf/${appId}`,
  //       { responseType: 'blob' }
  //     );
  //   }
}
