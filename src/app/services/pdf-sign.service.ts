import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PdfSignService {
  private baseUrl = `${environment.apiBaseUrl}/PdfSign`;

  constructor(private http: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('auth_token') || sessionStorage.getItem('token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  // Hardware PIN Verification API
  verifyTokenPin(serialNumber: string): Observable<any> {
    const url = `${this.baseUrl}/VerifyTokenPin?serialNumber=${encodeURIComponent(serialNumber)}`;
    return this.http.post<any>(url, {}, {
      headers: this.getAuthHeaders()
    });
  }

  // Token Diagnosis
  diagnoseToken(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/DiagnoseToken`, {
      headers: this.getAuthHeaders()
    });
  }

  // Digital Sign PDF with Dynamic Metadata for Dsc_Signed_PdfMaster Table
  signPdf(
    file: File, 
    signerName: string, 
    serialNumber: string, 
    metadata?: { 
      appId?: number; 
      finYear?: string; 
      aplNo?: string; 
      permitNo?: string; 
      district?: string; 
      companyName?: string; 
      userId?: number 
    }
  ): Observable<Blob> {
    const formData = new FormData();
    formData.append('File', file, file.name);
    formData.append('pdfFile', file, file.name);
    formData.append('SignerName', signerName);
    formData.append('SerialNumber', serialNumber);

    // Pass metadata to save into Dsc_Signed_PdfMaster
    if (metadata) {
      if (metadata.appId) formData.append('AppId', String(metadata.appId));
      if (metadata.finYear) formData.append('FinYear', metadata.finYear);
      if (metadata.aplNo) formData.append('AplNo', metadata.aplNo);
      if (metadata.permitNo) formData.append('PermitNo', metadata.permitNo);
      if (metadata.district) formData.append('DistrictId', metadata.district);
      if (metadata.companyName) formData.append('CompanyName', metadata.companyName);
      if (metadata.userId) formData.append('UserId', String(metadata.userId));
    }

    return this.http.post(`${this.baseUrl}/sign`, formData, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    });
  }

  // Get Direct URL for Issued Tab to View / Print Signed PDF from Database Table
  getSignedPdfUrl(appId: number): string {
    return `${this.baseUrl}/GetSignedPdfFile?appId=${appId}`;
  }

  // Live Certificates list from Windows Store
  getAvailableCertificates(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/GetAvailableCertificates`, {
      headers: this.getAuthHeaders()
    });
  }
}