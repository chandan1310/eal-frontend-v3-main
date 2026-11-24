import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { StockService } from '../services/stock.service';
import { ToastService } from '../services/toast.service';
import { OfficeService } from '../services/office.service';
import { PdfSignService } from '../services/pdf-sign.service';
import { SidebarComponent } from '../sidebar/sidebar.component'; 
import { FormsModule } from '@angular/forms';

declare var bootstrap: any;

@Component({
  selector: 'app-handover-otp-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, DatePipe],
  templateUrl: './handover-otp-modal.component.html',
  styleUrl: './handover-otp-modal.component.css',
  providers: [DatePipe]
})
export class HandoverOtpModalComponent implements OnInit {

  applications: any[] = [];
  loader: boolean = false;
  selectedAppForOtp: any = null;
  enteredReceivingOtp: string = '';

  financialYears: string[] = [];
  currentFinancialYear: string = '';
  allMonths: any[] = [];

  // Pagination Variables
  currentPage: number = 1;
  pageSize: number = 10; 
  filters: any = {
    FinancialYear: null,
    Month: null,
    DateFrom: null,
    userType: 'FL',
    Status: 14 
  };

  userTypeList = [
    { id: 'CL', name: 'Country Liquor' },
    { id: 'FL', name: 'Foreign Liquor' }
  ];

  constructor(
    private stockService: StockService,
    private toastService: ToastService,
    private officeService: OfficeService,
    private pdfSignService: PdfSignService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fillFinancialYears();
    this.loadAllMonths();
    this.fetchIssuedApplications();
  }

  fillFinancialYears(): void {
    const cur = new Date().getFullYear();
    const m = new Date().getMonth();
    const yr = m < 3 ? cur - 1 : cur;
    this.currentFinancialYear = `${yr}-${yr + 1}`;
    this.filters.FinancialYear = this.currentFinancialYear;
  }

  loadAllMonths(): void {
    this.stockService.getAllMonths().subscribe({
      next: (m) => this.allMonths = m,
      error: (e) => console.error('Months error:', e)
    });
  }

  fetchIssuedApplications(): void {
    this.loader = true;
    this.applications = [];
    this.currentPage = 1; 

    const payload = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value != null)
    );
    payload['Status'] = 14; 

    this.officeService.getAllApplications(payload).subscribe({
      next: (data: any) => {
        this.applications = (data || []).map((app: any) => {
          let req_fl_spirit_qty = 0, req_fl_malt_qty = 0, req_cl_plain_qty = 0, req_cl_masala_qty = 0;
          if (app.ApplicationDetails && Array.isArray(app.ApplicationDetails)) {
            app.ApplicationDetails.forEach((d: any) => {
              req_fl_spirit_qty += Number(d.req_fl_spirit_qty || 0);
              req_fl_malt_qty += Number(d.req_fl_malt_qty || 0);
              req_cl_plain_qty += Number(d.req_cl_plain_qty || 0);
              req_cl_masala_qty += Number(d.req_cl_masala_qty || 0);
            });
          }
          return { ...app, groupedData: { req_fl_spirit_qty, req_fl_malt_qty, req_cl_plain_qty, req_cl_masala_qty } };
        });
        this.loader = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching issued applications:', err);
        this.applications = [];
        this.loader = false;
      }
    });
  }

  resetFilters(): void {
    this.filters = {
      FinancialYear: this.currentFinancialYear,
      Month: null,
      DateFrom: null,
      userType: 'FL',
      Status: 14
    };
    this.fetchIssuedApplications();
  }

  // --- Pagination Getters & Methods ---
  get paginatedApplications(): any[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.applications.slice(startIndex, startIndex + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.applications.length / this.pageSize) || 1;
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  isHandoverVerified(app: any): boolean {
    if (!app || !app.AppId) return false;
    const localVerified = localStorage.getItem(`handover_${app.AppId}`) === 'true';
    return localVerified || app.IsHandoverVerified === true || app.DeliveryStatus === 'Completed' || app.HandoverDate != null;
  }

  openHandoverOtpModal(app: any) {
    this.selectedAppForOtp = app;
    this.enteredReceivingOtp = '';
    const modalEl = document.getElementById('handoverOtpModal');
    if (modalEl) new bootstrap.Modal(modalEl).show();
  }

  closeHandoverOtpModal() {
    const modalEl = document.getElementById('handoverOtpModal');
    if (modalEl) {
      const instance = bootstrap.Modal.getInstance(modalEl);
      if (instance) instance.hide();
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
  }

  sendReceivingOtpModal() {
    if (!this.selectedAppForOtp?.AppId) return;
    this.officeService.sendReceivingOtp({ AppId: Number(this.selectedAppForOtp.AppId) }).subscribe({
      next: (res: any) => this.toastService.show(res.message || 'OTP sent successfully', { class: 'success' }),
      error: (err: any) => this.toastService.show(err.error?.message || 'Failed to send OTP', { class: 'danger' })
    });
  }

  verifyReceivingOtpModal(): void {
    if (!this.selectedAppForOtp?.AppId || !this.enteredReceivingOtp || this.enteredReceivingOtp.trim().length !== 6) {
      this.toastService.show('Please enter a valid 6-digit OTP', { class: 'danger' });
      return;
    }

    const appId = Number(this.selectedAppForOtp.AppId);
    this.officeService.verifyReceivingOtp({ AppId: appId, Otp: this.enteredReceivingOtp.trim() }).subscribe({
      next: (res: any) => {
        this.toastService.show(res.message || 'Receiving OTP verified successfully.', { class: 'success' });
        localStorage.setItem(`handover_${appId}`, 'true');

        const index = this.applications.findIndex((x: any) => Number(x.AppId) === appId);
        if (index !== -1) {
          this.applications[index] = { ...this.applications[index], DeliveryStatus: 'Completed', HandoverDate: new Date().toISOString(), IsHandoverVerified: true };
        }
        this.closeHandoverOtpModal();
        this.cdr.detectChanges();
      },
      error: (err: any) => this.toastService.show(err.error?.message || 'Invalid or expired OTP', { class: 'danger' })
    });
  }

  // ==================== DIRECT SIGNED PDF ACTIONS (FROM Dsc_Signed_PdfMaster) ====================
  previewPermit(app: any): void {
    const appId = Number(app.AppId ?? app.appId ?? app.Id ?? 0);
    const url = this.pdfSignService.getSignedPdfUrl(appId);
    window.open(url, '_blank');
  }

  printPermit(app: any): void {
    const appId = Number(app.AppId ?? app.appId ?? app.Id ?? 0);
    const url = this.pdfSignService.getSignedPdfUrl(appId);
    const printWin = window.open(url, '_blank');
    if (printWin) {
      printWin.onload = () => {
        setTimeout(() => {
          printWin.focus();
          printWin.print();
        }, 500);
      };
    }
  }

  downloadPermit(app: any): void {
    const appId = Number(app.AppId ?? app.appId ?? app.Id ?? 0);
    const url = this.pdfSignService.getSignedPdfUrl(appId);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Signed_Permit_${app.EalApplicationNo ? app.EalApplicationNo.replace(/\//g, '_') : appId}.pdf`;
    a.click();
  }
}