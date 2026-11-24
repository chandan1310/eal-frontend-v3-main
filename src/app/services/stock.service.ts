// import { Injectable } from '@angular/core';
// import { HttpClient, HttpHeaders } from '@angular/common/http';
// import { Observable } from 'rxjs';
// import { environment } from '../../environments/environment';

// export interface PackSize {
//   packsizeId: number;
//   packsizeType: string;
//   NoOfBottles: number;
// }
// export interface MonthlyQuotaDto {
//   monthId: number;
//   monthName: string;
//   ealType: string;
//   quantity: number;
// }

// @Injectable({
//   providedIn: 'root',
// })
// export class StockService {
//   private stockUrl = environment.apiBaseUrl;
//   getBoxRange: any;

//   constructor(private http: HttpClient) { }

//   private getHeaders(): HttpHeaders {
//     const token = sessionStorage.getItem('auth_token');
//     return new HttpHeaders({
//       Authorization: `Bearer ${token}`,
//       'Content-Type': 'application/json',
//     });
//   }

//   getAllMonths(): Observable<string[]> {
//     return this.http.get<string[]>(`${this.stockUrl}/get/allMonths`, {
//       headers: this.getHeaders(),
//     });
//   }

//   ealtypes(): Observable<string[]> {
//     return this.http.get<string[]>(`${this.stockUrl}/get/ealtypes`, {
//       headers: this.getHeaders(),
//     });
//   }

//   getDistricts(): Observable<string[]> {
//     return this.http.get<string[]>(`${this.stockUrl}/get/districts`, {
//       headers: this.getHeaders(),
//     });
//   }

//   placefrom(): Observable<string[]> {
//     return this.http.get<string[]>(`${this.stockUrl}/get/placeMaster`, {
//       headers: this.getHeaders(),
//     });
//   }


//   // createStock(stockData: any): Observable<string[]> {
//   //   return this.http.post<string[]>(
//   //     `${this.stockUrl}/stock/create`,
//   //     stockData,
//   //     { headers: this.getHeaders() }
//   //   );
//   // }

//   // ✅ Create Stock API call
//   createStock(stockData: any): Observable<{ message: string; totalRecords: number }> {
//     return this.http.post<{ message: string; totalRecords: number }>(
//       `${this.stockUrl}/Stock/create`,  // ✅ Matches backend endpoint
//       stockData,
//       { headers: this.getHeaders() }
//     );
//   }

//   getStockEntriesDetails(filters: any): Observable<string[]> {
//     return this.http.get<string[]>(`${this.stockUrl}/stock/getEntries`, {
//       params: filters,
//       headers: this.getHeaders(),
//     });
//   }

//   getBoxNoList(): Observable<string[]> {
//     return this.http.get<string[]>(`${this.stockUrl}/stock/getBoxNoList`, {
//       headers: this.getHeaders(),
//     });
//   }

//   getAvailableLiquorQuantity(): Observable<string[]> {
//     return this.http.get<string[]>(`${this.stockUrl}/stock/getAvailableLiquorQuantity`, {
//       headers: this.getHeaders(),
//     });
//   }

//   getStockQuantityForAssignment(filters: any): Observable<string[]> {
//     return this.http.get<string[]>(`${this.stockUrl}/stock/getStockQuantityForAssignment`, {
//       params: filters,
//       headers: this.getHeaders(),
//     });
//   }

//   getStockOutwardDetails(): Observable<string[]> {
//     return this.http.get<string[]>(`${this.stockUrl}/ApplicationStatus/stockOutwardDetails`, {
//       headers: this.getHeaders(),
//     });
//   }

//   getStockLedgerDetails(): Observable<string[]> {
//     return this.http.get<string[]>(`${this.stockUrl}/stock/ledgerDetails`, {
//       headers: this.getHeaders(),
//     });
//   }

//   getStockInwardDetails(): Observable<string[]> {
//     return this.http.get<string[]>(`${this.stockUrl}/ApplicationStatus/stockInwardDetails`, {
//       headers: this.getHeaders(),
//     });
//   }
//   // ✅ New method for createIndent
//   createIndent(payload: any[]): Observable<any> {
//     return this.http.post<any>(`${this.stockUrl}/Get/createindent`, payload, {
//       headers: this.getHeaders(),
//     });
//   }

//   getIndents(): Observable<any[]> {
//     return this.http.get<any[]>(`${this.stockUrl}/Get/getindent`, {
//       headers: this.getHeaders(),
//     });
//   }
// updateIndentStatus(indentNo: string, status: string): Observable<any> {
//   return this.http.put<any>(
//     `${this.stockUrl}/Get/updateStatus/${indentNo}`,
//     `"${status}"`, // send raw string in quotes
//     { headers: this.getHeaders() }
//   );
// }



//   getBoxDetails(quantity: number): Observable<{
//     lastBoxNo: number;
//     startBoxNo: number;
//     endBoxNo: number;
//     lastSpoolEnd: number;
//     startSpoolNo: number;
//     endSpoolNo: number;
//   }> {
//     return this.http.get<{
//       lastBoxNo: number;
//       startBoxNo: number;
//       endBoxNo: number;
//       lastSpoolEnd: number;
//       startSpoolNo: number;
//       endSpoolNo: number;
//     }>(
//       `${environment.apiBaseUrl}/Stock/box-details?quantity=${quantity}`,
//       { headers: this.getHeaders() }
//     );
//   }

//   // searchDCs(dcNo: string, date?: string): Observable<any> {
//   //   const params: any = { dcNo };

//   //   if (date) params.date = date;
//   //   return this.http.get<any>(`${this.stockUrl}/stock/get-stock-by-dcno`, {
//   //     params,
//   //     headers: this.getHeaders()
//   //   });
//   // }
//   // stock.service.ts
//   searchDCs(dcNo: string, financialYear?: string): Observable<any[]> {
//     let params: any = {};

//     if (dcNo?.trim()) params.dcNo = dcNo.trim();
//     if (financialYear) params.financialYear = financialYear;

//     return this.http.get<any[]>(`${this.stockUrl}/stock/get-stock-by-dcno`, {
//       params,
//       headers: this.getHeaders()
//     });
//   }


//   getPackSizes(): Observable<any> {
//     return this.http.get<any>(
//       `${this.stockUrl}/Stock/packsizes`,
//       { headers: this.getHeaders() }
//     );
//   }
//   getEalTypes(): Observable<any> {
//     return this.http.get(`${this.stockUrl}/stock/get-ealtypes`);
//   }
//   getPackSizesByEalType(ealType: string) {
//     // console.log("Calling API with ealType:", ealType);

//     return this.http.get<any>(
//       `${this.stockUrl}/Stock/packsizes-by-eal`,
//       {
//         params: { ealType: ealType },
//         headers: this.getHeaders()
//       }
//     );
//   }
//   // Get all suppliers
//   getSuppliers(): Observable<any[]> {
//     return this.http.get<any[]>(`${this.stockUrl}/Stock/suppliers`, { headers: this.getHeaders() });
//   }

//   /** Fetch monthly Spirit/Malt quotas for a licencee */
//   getMonthlyQuota(licenceeId: number): Observable<MonthlyQuotaDto[]> {
//     return this.http.post<MonthlyQuotaDto[]>(
//       `${this.stockUrl}/Application/GetMonthlySpiritMalt`,
//       { licenceeId },
//       { headers: this.getHeaders() }
//     );
//   }






// }

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PackSize {
  packsizeId: number;
  packsizeType: string;
  NoOfBottles: number;
}

export interface MonthlyQuotaDto {
  monthId: number;
  monthName: string;
  ealType: string;
  quantity: number;
}

export interface CompanyDetailsDto {
  CompanyName: string;
  Address: string;
  State: string;
  District: string;
  PinCode: string;
  ModeOfTransport: string;
  Route: string;
}

@Injectable({
  providedIn: 'root',
})
export class StockService {
  private stockUrl = environment.apiBaseUrl;
  getBoxRange: any;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('auth_token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  // ✅ FIXED: Removed duplicate '/api' from the request path
  getCompanyDetails(supplierId: number): Observable<CompanyDetailsDto> {
    return this.http.get<CompanyDetailsDto>(
      `${this.stockUrl}/Stock/getCompanyDetails/${supplierId}`,
      { headers: this.getHeaders() }
    );
  }

  getAllMonths(): Observable<string[]> {
    return this.http.get<string[]>(`${this.stockUrl}/get/allMonths`, {
      headers: this.getHeaders(),
    });
  }

  ealtypes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.stockUrl}/get/ealtypes`, {
      headers: this.getHeaders(),
    });
  }

  getBottlingUnits(): Observable<any[]> {
    return this.http.get<any[]>(`${this.stockUrl}/Get/get/bottlingunits`, {
      headers: this.getHeaders(),
    });
  }

  getDistricts(): Observable<string[]> {
    return this.http.get<string[]>(`${this.stockUrl}/get/districts`, {
      headers: this.getHeaders(),
    });
  }

  placefrom(): Observable<string[]> {
    return this.http.get<string[]>(`${this.stockUrl}/get/placeMaster`, {
      headers: this.getHeaders(),
    });
  }

  createStock(stockData: any): Observable<{ message: string; totalRecords: number }> {
    return this.http.post<{ message: string; totalRecords: number }>(
      `${this.stockUrl}/Stock/create`,
      stockData,
      { headers: this.getHeaders() }
    );
  }

  getStockEntriesDetails(filters: any): Observable<string[]> {
    return this.http.get<string[]>(`${this.stockUrl}/stock/getEntries`, {
      params: filters,
      headers: this.getHeaders(),
    });
  }

  // GET: Authorised Persons by SupplierId
  // getAuthPersons(supplierId: number): Observable<any[]> {
  //   return this.http.get<any[]>(
  //     `${this.stockUrl}/Application/get-auth-person`,
  //     {
  //       params: { supplierId: supplierId.toString() },
  //       headers: this.getHeaders()
  //     }
  //   );
  // }

  getAuthPersons(supplierId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.stockUrl}/AuthPerson/get-auth-person`,
      {
        params: {
          supplierId: supplierId.toString()
        },
        headers: this.getHeaders()
      }
    );
  }
  // Delete method ko update karein
  deleteAuthPerson(id: number): Observable<any> {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('auth_token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
    return this.http.delete(`${this.stockUrl}/Application/delete-auth-person/${id}`); // Header hataya
  }

  // POST: Add new Authorised Person with Photo
  addAuthPerson(formData: FormData): Observable<any> {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('auth_token');

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post<any>(`${this.stockUrl}/AuthPerson/add-auth-person`, formData, { headers });
  }

  getBoxNoList(): Observable<string[]> {
    return this.http.get<string[]>(`${this.stockUrl}/stock/getBoxNoList`, {
      headers: this.getHeaders(),
    });
  }

  getAvailableLiquorQuantity(): Observable<string[]> {
    return this.http.get<string[]>(`${this.stockUrl}/stock/getAvailableLiquorQuantity`, {
      headers: this.getHeaders(),
    });
  }

  getStockQuantityForAssignment(filters: any): Observable<string[]> {
    return this.http.get<string[]>(`${this.stockUrl}/stock/getStockQuantityForAssignment`, {
      params: filters,
      headers: this.getHeaders(),
    });
  }

  getStockOutwardDetails(): Observable<string[]> {
    return this.http.get<string[]>(`${this.stockUrl}/ApplicationStatus/stockOutwardDetails`, {
      headers: this.getHeaders(),
    });
  }

  getStockLedgerDetails(): Observable<string[]> {
    return this.http.get<string[]>(`${this.stockUrl}/stock/ledgerDetails`, {
      headers: this.getHeaders(),
    });
  }

  getStockInwardDetails(): Observable<string[]> {
    return this.http.get<string[]>(`${this.stockUrl}/ApplicationStatus/stockInwardDetails`, {
      headers: this.getHeaders(),
    });
  }

  createIndent(payload: any[]): Observable<any> {
    return this.http.post<any>(`${this.stockUrl}/Get/createindent`, payload, {
      headers: this.getHeaders(),
    });
  }

  getIndents(): Observable<any[]> {
    return this.http.get<any[]>(`${this.stockUrl}/Get/getindent`, {
      headers: this.getHeaders(),
    });
  }

  // ---- Indent workflow (api/Indent) ----
  /** All indents with items, status and dispatch progress. */
  indentList(): Observable<any[]> {
    return this.http.get<any[]>(`${this.stockUrl}/Indent/list`, { headers: this.getHeaders() });
  }

  /** Approved indents that still have boxes to dispatch (Stock Entry). */
  indentsOpenForDispatch(): Observable<any[]> {
    return this.http.get<any[]>(`${this.stockUrl}/Indent/open-for-dispatch`, { headers: this.getHeaders() });
  }

  /** What the logged-in user may do: { CanCreate (Section), CanApprove (Nashik Admin), CanView }. */
  indentMyAccess(): Observable<any> {
    return this.http.get<any>(`${this.stockUrl}/Indent/my-access`, { headers: this.getHeaders() });
  }

  /** Per EAL type: labels in stock, boxes on order, monthly issue, suggested boxes. */
  indentCreateInfo(): Observable<any> {
    return this.http.get<any>(`${this.stockUrl}/Indent/create-info`, { headers: this.getHeaders() });
  }

  /** { Indent, Dispatches: [{ BoxNo, DcNo, EntryDate, FromNo, ToNo, EALName }] } */
  indentDetail(indentNo: string): Observable<any> {
    return this.http.get<any>(`${this.stockUrl}/Indent/${encodeURIComponent(indentNo)}/detail`, { headers: this.getHeaders() });
  }

  /** Nashik Admin home page: KPIs, indents to approve / dispatch, per-type progress, monthly dispatch, recent DCs. */
  pressDashboard(): Observable<any> {
    return this.http.get<any>(`${this.stockUrl}/Indent/press-dashboard`, { headers: this.getHeaders() });
  }

  /** Section: { StartDate, EndDate, Priority, Remark, Items: [{ EALTypeId, BoxQty }] } */
  createIndentV2(payload: any): Observable<any> {
    return this.http.post<any>(`${this.stockUrl}/Indent/create`, payload, { headers: this.getHeaders() });
  }

  /**
   * 'Approve' | 'Reject' (Nashik Admin) or 'Cancel' (Section).
   * Approve may carry ExpectedDispatchDate and Items: [{ IndentId, ApprovedBoxQty }] (fewer boxes than asked).
   */
  indentAction(indentNo: string, action: string, remark: string = '', extra: { ExpectedDispatchDate?: string | null; Items?: any[] } = {}): Observable<any> {
    return this.http.post<any>(`${this.stockUrl}/Indent/${encodeURIComponent(indentNo)}/action`,
      { Action: action, Remark: remark, ...extra }, { headers: this.getHeaders() });
  }

  updateIndentStatus(indentNo: string, status: string): Observable<any> {
    return this.http.put<any>(
      `${this.stockUrl}/Get/updateStatus/${indentNo}`,
      `"${status}"`,
      { headers: this.getHeaders() }
    );
  }

  // Get deactivated authorized persons list
  getDeactivatedAuthPersons(supplierId: number): Observable<any> {
    return this.http.get<any>(`${this.stockUrl}/AuthPerson/get-deactivated-auth-person?supplierId=${supplierId}`, {
      headers: this.getHeaders()
    });
  }

  // Deactivate authorized person (soft delete)
  // deactivateAuthPerson(id: number): Observable<any> {
  //   return this.http.post<any>(`${this.stockUrl}/AuthPerson/deactivate-auth-person/${id}`, {}, {
  //     headers: this.getHeaders()
  //   });
  // }
  deactivateAuthPerson(id: number, remark: string): Observable<any> {
    return this.http.post<any>(`${this.stockUrl}/AuthPerson/deactivate-auth-person/${id}`, { remark }, {
      headers: this.getHeaders()
    });
  }

  activateAuthPerson(id: number): Observable<any> {
    return this.http.post(`${this.stockUrl}/AuthPerson/activate-auth-person/${id}`, {}, {
      headers: this.getHeaders()
    });
  }

  // Admin ke liye pending list laane ke liye (Corrected with headers)
  getPendingAuthPersons(): Observable<any> {
    return this.http.get(`${this.stockUrl}/AuthPerson/get-pending-auth-persons`, {
      headers: this.getHeaders()
    });
  }

  // Admin ke dwara verify/reject karne ke liye (Corrected with headers)
  verifyAuthPerson(id: number, status: number): Observable<any> {
    return this.http.post(`${this.stockUrl}/AuthPerson/verify-auth-person/${id}`, { verificationStatus: status }, {
      headers: this.getHeaders()
    });
  }


  getBoxDetails(quantity: number): Observable<{
    lastBoxNo: number;
    startBoxNo: number;
    endBoxNo: number;
    lastSpoolEnd: number;
    startSpoolNo: number;
    endSpoolNo: number;
  }> {
    return this.http.get<{
      lastBoxNo: number;
      startBoxNo: number;
      endBoxNo: number;
      lastSpoolEnd: number;
      startSpoolNo: number;
      endSpoolNo: number;
    }>(
      `${this.stockUrl}/Stock/box-details?quantity=${quantity}`,
      { headers: this.getHeaders() }
    );
  }

  searchDCs(dcNo: string, financialYear?: string): Observable<any[]> {
    let params: any = {};
    if (dcNo?.trim()) params.dcNo = dcNo.trim();
    if (financialYear) params.financialYear = financialYear;

    return this.http.get<any[]>(`${this.stockUrl}/stock/get-stock-by-dcno`, {
      params,
      headers: this.getHeaders()
    });
  }

  getPackSizes(): Observable<any> {
    return this.http.get<any>(
      `${this.stockUrl}/Stock/packsizes`,
      { headers: this.getHeaders() }
    );
  }

  getEalTypes(): Observable<any> {
    return this.http.get(`${this.stockUrl}/stock/get-ealtypes`);
  }

  getPackSizesByEalType(ealType: string) {
    return this.http.get<any>(
      `${this.stockUrl}/Stock/packsizes-by-eal`,
      {
        params: { ealType: ealType },
        headers: this.getHeaders()
      }
    );
  }

  getSuppliers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.stockUrl}/Stock/suppliers`, { headers: this.getHeaders() });
  }

  getMonthlyQuota(licenceeId: number): Observable<MonthlyQuotaDto[]> {
    return this.http.post<MonthlyQuotaDto[]>(
      `${this.stockUrl}/Application/GetMonthlySpiritMalt`,
      { licenceeId },
      { headers: this.getHeaders() }
    );
  }
}