import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CountService } from '../services/count.service';
import { ApplicationformService } from '../services/applicationform.service';
import { jwtDecode } from 'jwt-decode';
import { FormsModule } from '@angular/forms';
import { StockService } from '../services/stock.service';
import { LoginService } from '../services/login.service';
import { Router } from '@angular/router';
import { NashikHomeComponent } from '../nashik-home/nashik-home.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, NashikHomeComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {

  role: string | null = null;
  userName: string | null = null;
  selectedYear: string = '';
  availableYears: string[] = [];

  selectedEalType: string = '';
  selectedPackSize: string = '';

  ealTypes: any[] = [];
  packSizes: any[] = [];
  allStatusMasters: any[] = [];

  // Stock totals
  stockEntriesCount = 0;
  boxesCount = 0;
  stockIssuedCount = 0;

  /** Per EAL type, keyed by EALType.Name (SPIRIT, MALT, PLAIN, MASALA, HOTEL/BAR …) – same keys the API uses. */
  receivedByType: Record<string, number> = {};
  issuedByType: Record<string, number> = {};

  /** Cards shown under each stock box – built from the EALType table (fallback if the API is unreachable). */
  typeCards: Array<{ key: string; label: string; group: string; icon: string; css: string }> = [];
  private static readonly TYPE_STYLE: Record<string, { icon: string; css: string }> = {
    'SPIRIT':    { icon: 'fa-glass',   css: 'icon-spirit' },
    'MALT':      { icon: 'fa-beer',    css: 'icon-malt' },
    'PLAIN':     { icon: 'fa-flask',   css: 'icon-plain' },
    'MASALA':    { icon: 'fa-tint',    css: 'icon-masala' },
    'HOTEL/BAR': { icon: 'fa-cutlery', css: 'icon-hotel' }
  };
  private static readonly DEFAULT_TYPES = [
    { Id: 1, Name: 'SPIRIT', Type: 'FOREIGN LIQUOR' },
    { Id: 2, Name: 'MALT', Type: 'FOREIGN LIQUOR' },
    { Id: 3, Name: 'PLAIN', Type: 'COUNTRY LIQUOR' },
    { Id: 4, Name: 'MASALA', Type: 'COUNTRY LIQUOR' },
    { Id: 5, Name: 'HOTEL/BAR', Type: 'HOTEL/BAR' }
  ];

  // Application Tracking Counts
  totalApplications = 0;
  totalPermitIssued = 0;
  pendingApplications = 0;
  inventoryDetailsCount = 0;

  totalUserApp = 0;
  totalUserPend = 0;
  totalUserIssued = 0;

  // Modal Properties & Filters
  isModalOpen: boolean = false;
  modalTitle: string = '';
  modalData: any[] = [];
  filteredModalData: any[] = [];
  modalLoader: boolean = false;
  userType: string | null = null;

  modalFilterFinancialYear: string = '';
  modalFilterMonth: string = '';
  modalFilterAppSearch: string = '';

  availableFinancialYears: string[] = [];
  availableMonths: string[] = [];

  constructor(
    private countService: CountService,
    private stockService: StockService,
    private loginService: LoginService,
    private applicationFormService: ApplicationformService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.buildTypeCards(HomeComponent.DEFAULT_TYPES);
    this.TokenBlacklistCheck();
    this.getUserRole();
    this.loadPackSizes();
    this.loadEalTypes();
    this.loadStatusMasters();
  }

  convertToCamelCase(str: string): string {
    if (!str) return '';
    return str
      .replace(/[-_]+/g, ' ')
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  getUserRole() {
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      const decoded: any = jwtDecode(token);
      this.role = decoded.Role?.trim();
      this.userType = decoded['UserType'];
      this.userName = this.convertToCamelCase(decoded.Username || this.role || 'Admin');

      if (this.role === 'Nashik Admin') {
        // Nashik press has its own dashboard (app-nashik-home loads its data)
      } else if (this.role === 'Admin') {
        this.loadAvailableYears();
        this.loadCounts(); 
      } else {
        this.loadUsers(); 
      }
    }
  }

  loadStatusMasters(): void {
    this.applicationFormService.getStatusMasters().subscribe({
      next: (response) => {
        this.allStatusMasters = response || [];
      },
      error: (err) => console.error('Error fetching Status Masters:', err)
    });
  }

  loadUsers(): void {
    this.countService.getUserCounts().subscribe({
      next: (data: any) => {
        const totalApp = data?.totalUserApplications ?? 0;
        this.animateCount('totalUserApp', totalApp);
        this.totalApplications = totalApp;

        this.loadUserDashboardCountsFromHistory();
      },
      error: (error) => console.error('❌ Error loading user dashboard:', error)
    });
  }

  loadUserDashboardCountsFromHistory() {
    const currentDate = new Date();
    let year = currentDate.getFullYear();
    if (currentDate.getMonth() < 3) year--;

    const params = {
      financialYear: `${year}-${year + 1}`,
      userType: this.userType,
      pageNumber: 1,
      pageSize: 500
    };

    this.applicationFormService.applicationHistoryByYear(params).subscribe({
      next: (response: any) => {
        const rawData = response || [];

        const formatted = rawData.map((app: any) => {
          const rawStatus = String(app.Status || app.status || '').trim();
          const matchedStatusObj = this.allStatusMasters.find(s => String(s.Status_Id) === rawStatus);
          const statusName = matchedStatusObj ? matchedStatusObj.Status_Name.trim().toLowerCase() : '';

          const isPending = rawStatus === '1' || statusName.includes('pending');
          const hasValidChallan = app.ChallanNos && app.ChallanNos !== '-' && app.ChallanNos.trim() !== '';
          const isIssued = hasValidChallan && !isPending;

          return {
            ...app,
            isPending,
            isIssued
          };
        });

        const pendingList = formatted.filter((x: any) => x.isPending);
        const issuedList = formatted.filter((x: any) => x.isIssued);

        this.animateCount('totalUserPend', pendingList.length);
        this.animateCount('totalUserIssued', issuedList.length);

        this.pendingApplications = pendingList.length;
      },
      error: (err) => console.error('❌ Error loading history counts:', err)
    });
  }

  TokenBlacklistCheck(): void {
    const token = sessionStorage.getItem('auth_token');
    this.loginService.checkToken().subscribe({
      next: (res) => {},
      error: (err) => {
        sessionStorage.clear();
        this.router.navigate(['/login']);
      }
    });
  }

  loadPackSizes() {
    this.stockService.getPackSizes().subscribe({
      next: (data) => { this.packSizes = data; },
      error: (err) => console.error('❌ Error loading pack sizes:', err)
    });
  }

  loadEalTypes(): void {
    this.stockService.ealtypes().subscribe({
      next: (eals: any) => {
        this.ealTypes = eals || [];
        if (this.ealTypes.length) this.buildTypeCards(this.ealTypes);
      },
      error: (err) => console.error('Error fetching EAL Types:', err)
    });
  }

  /** One card per EALType row (the API may repeat a type once per code – keep the first). */
  private buildTypeCards(types: any[]): void {
    const seen = new Set<string>();
    this.typeCards = [...types]
      .sort((a, b) => Number(a.Id ?? a.EALTypeId) - Number(b.Id ?? b.EALTypeId))
      .map(t => ({ name: String(t.Name || '').trim(), type: String(t.Type || '').trim() }))
      .filter(t => t.name && !seen.has(t.name.toUpperCase()) && !!seen.add(t.name.toUpperCase()))
      .map(t => {
        const key = t.name.toUpperCase();
        const style = HomeComponent.TYPE_STYLE[key] || { icon: 'fa-tag', css: 'icon-plain' };
        return {
          key,
          label: this.convertToCamelCase(t.name).replace(/\s*\/\s*/g, '/'),
          group: key === t.type.toUpperCase() ? '' : this.convertToCamelCase(t.type),
          icon: style.icon,
          css: style.css
        };
      });
  }

  received(key: string): number { return this.receivedByType[key] || 0; }
  issued(key: string): number { return this.issuedByType[key] || 0; }
  balance(key: string): number { return this.received(key) - this.issued(key); }
  get balanceTotal(): number { return (this.stockEntriesCount || 0) - (this.stockIssuedCount || 0); }

  /** Short Indian number: 95,90,000 → "95.9 L", 2,23,30,000 → "2.23 Cr". Full number is shown on hover. */
  short(value: number | null | undefined): string {
    const n = Number(value || 0);
    const abs = Math.abs(n);
    const trim = (x: number, d: number) => String(Number(x.toFixed(d)));
    if (abs >= 1e7) return trim(n / 1e7, 2) + ' Cr';
    if (abs >= 1e5) return trim(n / 1e5, abs >= 1e6 ? 1 : 2) + ' L';
    if (abs >= 1e3) return trim(n / 1e3, 1) + ' K';
    return String(n);
  }

  full(value: number | null | undefined): string {
    return Number(value || 0).toLocaleString('en-IN');
  }

  /** Office dashboard (Admin / Commissioner – their token role is "Admin"). */
  get isAdminView(): boolean {
    return this.role === 'Admin';
  }

  /** Nashik press: indents and dispatches only. */
  get isPressView(): boolean {
    return this.role === 'Nashik Admin';
  }

  loadAvailableYears(): void {
    this.countService.getSummaryAdminCounts().subscribe({
      next: (data) => { this.availableYears = data?.AvailableYears || []; },
      error: (err) => console.error("❌ Error loading years:", err)
    });
  }

  loadCounts(): void {
    const params: any = {};
    if (this.selectedYear) params.year = this.selectedYear;
    if (this.selectedPackSize) params.packSizes = this.selectedPackSize;

    this.countService.getSummaryAdminCounts(params).subscribe((data) => {
      const upperKeys = (o: any) => Object.fromEntries(
        Object.entries(o || {}).map(([k, v]) => [String(k).trim().toUpperCase(), Number(v) || 0]));
      this.receivedByType = upperKeys(data?.EALTypeCountsOverall);
      this.issuedByType = upperKeys(data?.EALTypeCountsPurchased);
      this.stockEntriesCount = data?.TotalStockEntries || 0;
      this.boxesCount = data?.TotalBoxes || 0;
      this.stockIssuedCount = data?.TotalStockIssued || 0;
      this.animateCount('totalApplications', data?.TotalApplications || 0);
      this.animateCount('totalPermitIssued', data?.TotalPermitIssued || 0);
      this.animateCount('pendingApplications', data?.PendingApplications || 0);
      this.animateCount('inventoryDetailsCount', data?.TotalInventoryDetails || 0);
      this.availableYears = data?.AvailableYears || [];
    });
  }

  animateCount(prop: any, target: number): void {
    let startTime: number | null = null;
    const duration = 1000;
    const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      this[prop] = Math.floor(easeOutQuad(progress) * target);

      if (progress < 1) requestAnimationFrame(step);
      else this[prop] = target;
    };

    requestAnimationFrame(step);
  }

  openDetailsModal(type: string) {
    this.modalTitle = type;
    this.isModalOpen = true;
    this.modalData = [];
    this.filteredModalData = [];
    this.modalLoader = true;
    
    this.modalFilterFinancialYear = '';
    this.modalFilterMonth = '';
    this.modalFilterAppSearch = '';
    this.availableFinancialYears = [];
    this.availableMonths = [];

    const currentDate = new Date();
    let year = currentDate.getFullYear();
    if (currentDate.getMonth() < 3) year--;

    const params = {
      financialYear: `${year}-${year + 1}`,
      userType: this.userType,
      pageNumber: 1,
      pageSize: 500
    };

    this.applicationFormService.applicationHistoryByYear(params).subscribe({
      next: (response: any) => {
        let rawData = response || [];

        const formatted = rawData.map((app: any) => {
          let demandData: string[] = [];
          
          if (app.ApplicationDetails && app.ApplicationDetails.length > 0) {
            app.ApplicationDetails.forEach((d: any) => {
              const matchedType = this.ealTypes.find(t => String(t.Id) === String(d.EALType));
              if (matchedType) {
                demandData.push(`${matchedType.Type} (${matchedType.Code})`);
              } else {
                demandData.push(`Type ${d.EALType}`);
              }
            });
          }

          const demandStr = demandData.length > 0 ? demandData.join(', ') : '-';
          const appDate = app.CreateDate || app.createDate;
          const monthName = appDate ? new Date(appDate).toLocaleString('default', { month: 'long', year: 'numeric' }) : '-';
          const fy = app.FinancialYear || `${year}-${year + 1}`;
          const appNo = app.EalApplicationNo || app.AppId || '-';
          
          const rawStatus = String(app.Status || app.status || '').trim();
          const matchedStatusObj = this.allStatusMasters.find(s => String(s.Status_Id) === rawStatus);
          const statusName = matchedStatusObj ? matchedStatusObj.Status_Name.trim().toLowerCase() : '';

          const isPending = rawStatus === '1' || statusName.includes('pending');
          const hasValidChallan = app.ChallanNos && app.ChallanNos !== '-' && app.ChallanNos.trim() !== '';
          const isIssued = hasValidChallan && !isPending;

          return {
            financialYear: fy,
            month: monthName,
            packSize: demandStr,
            applicationNo: appNo,
            labelNo: hasValidChallan ? app.ChallanNos : 'Pending / Not Issued',
            isPending,
            isIssued
          };
        });

        if (type === 'Pending Applications') {
          rawData = formatted.filter((x: any) => x.isPending);
        } else if (type === 'Issued Applications') {
          rawData = formatted.filter((x: any) => x.isIssued);
        } else {
          rawData = formatted;
        }

        this.modalData = rawData;
        this.filteredModalData = [...this.modalData];
        this.availableFinancialYears = [...new Set(this.modalData.map(item => item.financialYear))];
        this.availableMonths = [...new Set(this.modalData.map(item => item.month))];
        
        this.modalLoader = false;
      },
      error: (err) => {
        console.error('❌ Error fetching details:', err);
        this.modalData = [];
        this.filteredModalData = [];
        this.modalLoader = false;
      }
    });
  }

  applyModalFilter() {
    this.filteredModalData = this.modalData.filter(item => {
      const matchFY = this.modalFilterFinancialYear ? item.financialYear === this.modalFilterFinancialYear : true;
      const matchMonth = this.modalFilterMonth ? item.month === this.modalFilterMonth : true;
      const matchAppSearch = this.modalFilterAppSearch ? item.applicationNo.toLowerCase().includes(this.modalFilterAppSearch.toLowerCase()) : true;

      return matchFY && matchMonth && matchAppSearch;
    });
  }

  resetModalFilter() {
    this.modalFilterFinancialYear = '';
    this.modalFilterMonth = '';
    this.modalFilterAppSearch = '';
    this.filteredModalData = [...this.modalData];
  }

  closeModal() {
    this.isModalOpen = false;
    this.modalData = [];
    this.filteredModalData = [];
  }
}