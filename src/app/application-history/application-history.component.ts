import { Component, OnInit } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../services/stock.service';
import { ApplicationformService } from '../services/applicationform.service';
import { Router, RouterLink } from '@angular/router';
import { jwtDecode } from 'jwt-decode';

@Component({
  selector: 'app-application-history',
  standalone: true,
  imports: [SidebarComponent, CommonModule, FormsModule],
  templateUrl: './application-history.component.html',
  styleUrl: './application-history.component.css'
})
export class ApplicationHistoryComponent implements OnInit {

  financialYears: string[] = [];
  ealTypes: any[] = [];
  allStatus: any[] = [];
  applicationHistory: any[] = [];
  fullApplicationHistory: any[] = [];
  loader: boolean = true;
  userType: string | null = null;
  selectedApplication: any = {};

  // Pagination Properties
  currentPage: number = 1;
  itemsPerPage: number = 10;
  Math = Math; // Exposed to template for calculation

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

  // --- Pagination Helpers ---
  // Ensure this is inside the class, not outside of it
  get paginatedHistory() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.applicationHistory.slice(startIndex, startIndex + this.itemsPerPage);
  }
  changePage(page: number) {
    if (page >= 1 && page <= Math.ceil(this.applicationHistory.length / this.itemsPerPage)) {
      this.currentPage = page;
    }
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

  getSupplierApplicationHistory(page: number = 1) {
    this.loader = true;
    this.currentPage = page;
    const currentDate = new Date();
    let year = currentDate.getFullYear();
    if (currentDate.getMonth() < 3) year--;

    const params = {
      financialYear: `${year}-${year + 1}`,
      userType: this.userType,
      pageNumber: this.currentPage,
      pageSize: this.itemsPerPage
    };

    this.applicationFormService.applicationHistoryByYear(params).subscribe({
      next: (response: any) => {
        const formatted = response.map((app: any) => {
          let demandData: any[] = [];
          let demandDataObject: any[] = [];
          let demandDataObjectViewMode: any[] = [];
          // console.log('Processing application:', app);
          if (app.ApplicationDetails || app.req_cl_plain_qty !== undefined) {
            const detailsArray = app.ApplicationDetails || [app];
            detailsArray.forEach((d: any) => {
              const typeMapping: { [key: string]: string } = {
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
              switch (String(d.EALType)) {
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
                detailId: `${d.DetailId || 0}`,
                assignedQuantity: quantity
              });
            });
          }

          const normalizedStatus = app.Status || app.status;
          const statusName = this.allStatus.find(t => String(t.Status_Id) === String(normalizedStatus));

          let formattedPOs = '-';
          if (app.PurchaseOrderNos) {
            formattedPOs = [...new Set(app.PurchaseOrderNos.split(','))]
              .filter(x => (x as string).trim() !== '').join(', ');
          }

          let formattedChallans = '-';
          if (app.ChallanNos) {
            formattedChallans = [...new Set(app.ChallanNos.split(','))]
              .filter(x => (x as string).trim() !== '').join(', ');
          }

          return {
            ...app,
            CreateDate: app.CreateDate || app.createDate,
            Company_Name: app.Company_name || app.Company_Name,
            Status: normalizedStatus,
            PurchaseOrderNos: formattedPOs || '-',
            ChallanNos: formattedChallans || '-',
            DemandNos: demandData.length > 0 ? demandData.join(', ') : '-',
            DemandDataObject: demandDataObject,
            StatusName: statusName ? statusName.Status_Name : (normalizedStatus === '1' ? 'Pending' : 'Unknown'),
            DemandDataObjectViewMode: demandDataObjectViewMode,
            PersonName: app.PersonName || '-',
            Designation: app.Designation || '-',
            Photo: app.Photo || null,
          };
        });

        // Sorting
        formatted.sort((a: any, b: any) => new Date(b.CreateDate).getTime() - new Date(a.CreateDate).getTime());

        this.fullApplicationHistory = formatted;
        this.applicationHistory = [...formatted];
        this.currentPage = 1; // Reset to page 1
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
      const searchStatus = String(this.filter.status).trim().toLowerCase();
      filtered = filtered.filter(x =>
        String(x.Status).trim().toLowerCase() === searchStatus ||
        (x.StatusName && String(x.StatusName).trim().toLowerCase() === searchStatus)
      );
    }
    this.applicationHistory = filtered;
    this.currentPage = 1; // Reset to page 1
  }

  // onActionClick(mode: string, selectedApplicationValue: any) {
  //   this.applicationFormService.setSelectedSupplierApplication(mode, selectedApplicationValue);
  //   this.route.navigate(['/application-detail', selectedApplicationValue['AppId']]);
  // }
  onActionClick(mode: string, selectedApplicationValue: any) {
    const appId = selectedApplicationValue['AppId'] || selectedApplicationValue['appId'] || selectedApplicationValue['id'];

    if (!appId) {
      console.error("AppId not found in application object:", selectedApplicationValue);
      return;
    }

    this.applicationFormService.setSelectedSupplierApplication(mode, selectedApplicationValue);
    this.route.navigate(['/application-detail', appId]);
  }

  isEmptyObject(obj: any): boolean {
    return obj && Object.keys(obj).length === 0;
  }
}

