import { Component, OnInit } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../services/stock.service';
import { ApplicationformService } from '../services/applicationform.service';
import { Router, RouterLink } from '@angular/router';
import { jwtDecode } from 'jwt-decode';

@Component({
    selector: 'app-barapplication-history',
    standalone: true,
    imports: [SidebarComponent, CommonModule, FormsModule],
    templateUrl: './barapplication-history.component.html',
    styleUrl: './barapplication-history.component.css'
})
export class BarapplicationHistoryComponent implements OnInit {

  financialYears: string[] = [];
  ealTypes: any[] = [];
  allStatus: any[] = [];
  applicationHistory: any[] = [];
  fullApplicationHistory: any[] = []; 
  loader: boolean = true;
  userType: string = null;
  selectedApplication: any = {};

  filter = {
    financialYear: '',
    status: ''
  };

  constructor(
    private stockService: StockService,
    private applicationFormService: ApplicationformService,
    private route: Router
  ) { }

  ngOnInit(): void {
    this.getUserType();
    this.loadEalTypes();
    this.loadStatusMasters();
    this.loadFinancialYears(); 
  }

  loadFinancialYears() {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    years.push(`${currentYear - 1}-${currentYear}`);
    years.push(`${currentYear}-${currentYear + 1}`);
    years.push(`${currentYear + 1}-${currentYear + 2}`);
    this.financialYears = years;
  }

  getUserType() {
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      const decodedToken: any = jwtDecode(token);
      this.userType = decodedToken['UserType'];
    }
  }

  loadEalTypes(): void {
    this.stockService.ealtypes().subscribe({
      next: (eals) => {
        this.ealTypes = eals;
        // ✅ ईल-टाइप्स लोड होने के ठीक बाद ही हिस्ट्री लोड करें ताकि मैपिंग के लिए मास्टर आईडी पहले से मौजूद हों
        this.getSupplierApplicationHistory();
      },
      error: (err) => {
        console.error('Error fetching EAL Types:', err);
        this.getSupplierApplicationHistory();
      }
    });
  }

  loadStatusMasters(): void {
    this.applicationFormService.getStatusMasters().subscribe({
      next: (response) => this.allStatus = response,
      error: (err) => console.error('Error fetching Status Masters:', err)
    });
  }

  getSupplierApplicationHistory() {
    this.loader = true;
    const currentDate = new Date();
    let year = currentDate.getFullYear();
    if (currentDate.getMonth() < 3) year--; 

    const params = {
      financialYear: `${year}-${year + 1}`,
      userType: this.userType // ✅ 'UserType' की केसिंग को बदलकर 'userType' किया गया जो आपकी API एक्सपेक्ट करती है
    };

    this.applicationFormService.getSupplierBarApplicationHistoryDetails(params).subscribe({
      next: (response: any) => {
        const formatted = response.map(app => {
          let demandData = [];
          let demandDataObject = [];
          let demandDataObjectViewMode = [];

          app.ApplicationDetails?.forEach(d => {
            const typeMapping = {
              '1': 'req_fl_spirit_qty',
              '2': 'req_fl_malt_qty',
              '3': 'req_cl_plain_qty',
              '4': 'req_cl_masala_qty',
              '5': 'req_hotel_bar_qty'
            };

            const matchedType = this.ealTypes.find(t => t.Id == d.EALType);
            if (matchedType && typeMapping[d.EALType]) {
              demandData.push(`${matchedType.Type}-(${matchedType.Code}): ${d[typeMapping[d.EALType]]}`);
              demandDataObject.push({ type: `${matchedType.Type} (${matchedType.Code})`, qty: `${d[typeMapping[d.EALType]]}` });
            }

            let quantity = 0;
            switch (d.EALType) {
              case '1': quantity = d.Approve_fl_spirit_qty; break;
              case '2': quantity = d.Approve_fl_malt_qty; break;
              case '3': quantity = d.Approve_cl_plain_qty; break;
              case '4': quantity = d.Approve_cl_masala_qty; break;
              case '5': quantity = d.Approve_hotel_bar_qty; break;
            }

            demandDataObjectViewMode.push({
              type: matchedType ? `${matchedType.Type} (${matchedType.Code})` : 'Unknown',
              qty: `${d[typeMapping[d.EALType]] || 0}`,
              id: `${d.EALType}`,
              detailId: `${d.DetailId}`,
              assignedQuantity: quantity
            });
          });

          const statusName = this.allStatus.find(t => t.Status_Id == app.Status);
          const verifiedDocuments = app?.Documents?.filter(doc => doc.Status === 'valid') || [];
          const notVerifiedDocuments = app?.Documents?.filter(doc => doc.Status === 'invalid') || [];

          const challanList = Array.isArray(app.Challans)
            ? app.Challans.filter(ch => ch?.ChallanNo)
            : [];

          return {
            ...app,
            CreateDate: app.CreateDate || app.createDate,
            Company_Name: app.Company_name || app.Company_Name,
            PurchaseOrderNos: app.PurchaseOrders?.map(po => po.PurchaseOrderNo).join(', ') || '',
            ChallanList: challanList,
            DemandNos: demandData.length > 0 ? demandData.join(', ') : '-',
            DemandDataObject: demandDataObject,
            StatusName: statusName ? statusName.Status_Name : (app.Status === '1' ? 'Pending' : 'Unknown'),
            VerifiedDocuments: verifiedDocuments,
            NotVerifiedDocuments: notVerifiedDocuments,
            DemandDataObjectViewMode: demandDataObjectViewMode,
          };
        });

        this.fullApplicationHistory = formatted; 
        this.applicationHistory = [...formatted]; 
        this.loader = false;
      },
      error: (err) => {
        console.error("Error loading application history:", err);
        this.loader = false;
      }
    });
  }

  applyFilter() {
    let filtered = [...this.fullApplicationHistory];

    if (this.filter.financialYear) {
      filtered = filtered.filter(x => x.FinancialYear === this.filter.financialYear);
    }

    if (this.filter.status) {
      filtered = filtered.filter(x => x.Status == this.filter.status);
    }

    this.applicationHistory = filtered;
  }

  onActionClick(mode: string, selectedApplicationValue: any) {
    this.applicationFormService.setSelectedSupplierApplication(mode, selectedApplicationValue);
    this.route.navigate(['/application-detail', selectedApplicationValue['AppId']]);
  }

  isEmptyObject(obj: any): boolean {
    return obj && Object.keys(obj).length === 0;
  }

  getGlobalIndex(entryIndex: number, boxIndex: number): number {
    return boxIndex * 9 + entryIndex + 1;
  }
}