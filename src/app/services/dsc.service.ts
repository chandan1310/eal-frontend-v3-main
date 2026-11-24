import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DscService {
  private baseUrl = `${environment.apiBaseUrl}/Dsc`;

  constructor(private http: HttpClient) { }

  getCertificates() {
    return this.http.get(`${this.baseUrl}/GetCertificates`);
  }

  signPdfDocument(formData: FormData) {
    return this.http.post(`${this.baseUrl}/SignPdf`, formData, { responseType: 'blob' });
  }
}