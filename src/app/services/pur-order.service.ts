import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PurOrderService {
  private pur_api = `${environment.apiBaseUrl}/PurchaseOrder`;
  private application_api = `${environment.apiBaseUrl}/Application`;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('auth_token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  getPurchaseOrder(): Observable<any[]> {
    return this.http.get<any[]>(`${this.pur_api}/GetAllOrders`, {
      headers: this.getHeaders(),
    });
  }

  getSupplierDetails(): Observable<any[]> {
    return this.http.get<any[]>(`${this.application_api}/getSupplierDetails`, {
      headers: this.getHeaders(),
    });
  }

  getSupplierChallanDetails(filters: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.application_api}/getSupplierChallanDetails`, {
      params: filters,
      headers: this.getHeaders(),
    });
  }

  // FOREIGN LIQUOR
  getPurchaseOrderFL(): Observable<any[]> {
    return this.http.get<any[]>(`${this.pur_api}/GetAllOrdersFL`, {
      headers: this.getHeaders(),
    });
  }

  getSupplierChallanDetailsFL(filters: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.application_api}/getSupplierChallanDetailsFL`, {
      params: filters,
      headers: this.getHeaders(),
    });
  }

  /** CL challans with used / remaining amount (same shape as the FL list). */
  getSupplierChallanDetailsCL(filters: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.application_api}/getSupplierChallanDetailsCL`, {
      params: filters,
      headers: this.getHeaders(),
    });
  }

  getPurchaseOrdersBySupplierId(supplierId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.pur_api}/supplier/${supplierId}`, {
      headers: this.getHeaders(),
    });
  }

  getPurchaseOrderDetailsById(purOrderId: number): Observable<any> {
    return this.http.get<any>(`${this.pur_api}/details/${purOrderId}`, {
      headers: this.getHeaders()
    });
  }
}

// import { Injectable } from '@angular/core';
// import { HttpClient, HttpHeaders } from '@angular/common/http';
// import { Observable } from 'rxjs';
// import { environment } from '../../environments/environment';

// @Injectable({
//   providedIn: 'root',
// })
// export class PurOrderService {
//   private pur_api = `${environment.apiBaseUrl}/PurchaseOrder`;
//   private application_api = `${environment.apiBaseUrl}/Application`;


//   constructor(private http: HttpClient) { }

//   private getHeaders(): HttpHeaders {
//     const token = sessionStorage.getItem('auth_token');
//     return new HttpHeaders({
//       Authorization: `Bearer ${token}`,
//       'Content-Type': 'application/json',
//     });
//   }

//   getPurchaseOrder(): Observable<any[]> {
//     return this.http.get<any[]>(`${this.pur_api}/GetAllOrders`, {
//       headers: this.getHeaders(),
//     });
//   }

//   getSupplierDetails(): Observable<any[]> {
//     return this.http.get<any[]>(`${this.application_api}/getSupplierDetails`, {
//       headers: this.getHeaders(),
//     });
//   }

//   // getSupplierDetails() {
//   //   const token = localStorage.getItem('authToken'); // or however you store it
//   //   const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
//   //   return this.http.get<any[]>(`${this.application_api}/getSupplierDetails`, {
//   //     headers: this.getHeaders(),
//   //   });
//   // }

//   getSupplierChallanDetails(filters: any): Observable<any[]> {
//     return this.http.get<any[]>(`${this.application_api}/getSupplierChallanDetails`, {
//       params: filters,
//       headers: this.getHeaders(),
//     });
//   }

//   // FOREGIN LIQUOR
//   getPurchaseOrderFL(): Observable<any[]> {
//     return this.http.get<any[]>(`${this.pur_api}/GetAllOrdersFL`, {
//       headers: this.getHeaders(),
//     });
//   }

//   getSupplierChallanDetailsFL(filters: any): Observable<any[]> {
//     return this.http.get<any[]>(`${this.application_api}/getSupplierChallanDetailsFL`, {
//       params: filters,
//       headers: this.getHeaders(),
//     });
//   }

//   /** ✅ NEW METHOD: Get purchase orders by SupplierId */
//   getPurchaseOrdersBySupplierId(supplierId: number): Observable<any[]> {
//     return this.http.get<any[]>(`${this.pur_api}/supplier/${supplierId}`, {
//       headers: this.getHeaders(),
//     });
//   }

// }
