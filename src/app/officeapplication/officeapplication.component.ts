import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OfficeService } from '../services/office.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../services/toast.service';
import { StockService } from '../services/stock.service';
import { PdfSignService } from '../services/pdf-sign.service';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { NumberToWordsPipe } from '../number-to-words.pipe';
import { ApplicationformService } from '../services/applicationform.service';
import { ApprovalWorkflowService, WORKFLOW_TAB_LABELS, WorkflowContext, WorkflowLevelInfo, WorkflowQueueItem, WorkflowTab } from '../services/approval-workflow.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

(pdfMake as any).vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : (pdfFonts as any).vfs;

declare var bootstrap: any;

@Component({
  selector: 'app-officeapplication',
  standalone: true,
  imports: [SidebarComponent, CommonModule, FormsModule],
  templateUrl: './officeapplication.component.html',
  styleUrl: './officeapplication.component.css',
  providers: [DatePipe, NumberToWordsPipe]
})
export class OfficeapplicationComponent implements OnInit {
  financialYears: string[] = [];
  currentFinancialYear: string = '';
  allMonths: any[] = [];
  stockEntryData: any[] = [];
  applications: any[] = [];
  selectedApplication: any = {};
  signingAppId: number | null = null;
  isSigning: boolean = false;
  pageSize: number = 2;
  totalPages: number[] = [];
  selectedAppForOtp: any = null;
  enteredReceivingOtp: string = '';
  districtLookup: { [key: number]: string } = {};

  filters: any = {
    FinancialYear: null,
    Month: null,
    DateFrom: null,
    DateTo: null,
    userType: 'FL',
    EALType: null,
    Search: null,
    Status: 1
  };

  availableLiquorQuantity: any = {
    'SPIRIT': 0,
    'MALT': 0,
    'PLAIN': 0,
    'MASALA': 0,
    'HOTEL/BAR': 0
  };

  ealTypes: any[] = [];
  allStatus: any[] = [];
  loader: boolean = false;

  userTypeList = [
    { id: 'CL', name: 'Country Liquor' },
    { id: 'FL', name: 'Foreign Liquor' }
  ];
  selectedUserType = this.filters.userType;

  // ==================== APPROVAL WORKFLOW CONFIGURATION ====================
  readonly tabLabels = WORKFLOW_TAB_LABELS;
  workflowEnabled = false;
  wfContext: WorkflowContext | null = null;
  myLevels: WorkflowLevelInfo[] = [];
  activeLevelId: number | null = null;
  activeTab: WorkflowTab = 'Pending';
  previousLevelName: string | null = null;
  private readonly lastViewStorageKey = 'wf_last_view';

  constructor(
    private stockService: StockService,
    private toastService: ToastService,
    private Officeservice: OfficeService,
    private route: Router,
    private applicationFormService: ApplicationformService,
    private datePipe: DatePipe,
    private numberToWordsPipe: NumberToWordsPipe,
    private pdfSignService: PdfSignService,
    private cdr: ChangeDetectorRef,
    private approvalWorkflowService: ApprovalWorkflowService
  ) { }

  ngOnInit(): void {
    this.loadDistrictMasterLookup();
    this.loadStatusMasters();
    this.loadEalTypes();
    this.fillFinancialYears();
    this.loadAllMonths();
    this.loadLiquorQuantity();
    this.initWorkflow();
  }

  private initWorkflow(): void {
    this.approvalWorkflowService.getMyContext(true).subscribe({
      next: (ctx) => {
        this.wfContext = ctx;
        this.workflowEnabled = !!ctx?.WorkflowEnabled;

        if (!this.workflowEnabled) {
          this.fetchAllApplications(1);
          return;
        }

        // The API decides which levels the logged-in user may act at (IsMine) – no client-side role matching.
        this.myLevels = (ctx.Levels || [])
          .filter(l => l.IsMine)
          .sort((a, b) => a.Position - b.Position);

        if (this.myLevels.length === 0) {
          this.applications = [];
          this.loader = false;
          this.cdr.detectChanges();
          return;
        }

        const last = this.readLastView();
        const restored = last ? this.myLevels.find(l => l.LevelId === last.levelId) : undefined;
        const chosenLevel = restored || this.myLevels[0];
        this.activeLevelId = chosenLevel.LevelId;
        this.activeTab = restored && this.tabsForLevel(chosenLevel).includes(last!.tab) ? last!.tab : 'Pending';
        this.fetchWorkflowApplications();
      },
      error: () => {
        this.workflowEnabled = false;
        this.fetchAllApplications(1);
      }
    });
  }

  get activeLevel(): WorkflowLevelInfo | undefined {
    return this.myLevels.find(l => l.LevelId === this.activeLevelId) || this.myLevels[0];
  }

  /** Tabs come from the API (derived from the level's position: first / middle / final). */
  tabsForLevel(level: WorkflowLevelInfo | undefined = this.activeLevel): WorkflowTab[] {
    if (!level) return ['Pending', 'Approved', 'Rejected'];
    if (Array.isArray(level.Tabs) && level.Tabs.length) return level.Tabs;
    return level.IsFinal ? ['Pending', 'PermitDsc', 'Issued', 'Rejected'] : ['Pending', 'Approved', 'Rejected'];
  }

  get activeLevelIsFinal(): boolean {
    return this.activeLevel?.Responsibility === 'FINAL' || !!this.activeLevel?.IsFinal;
  }

  selectLevel(levelId: number): void {
    if (this.activeLevelId === levelId) return;
    this.activeLevelId = levelId;

    const targetLevel = this.myLevels.find(l => l.LevelId === levelId);
    const validTabs = this.tabsForLevel(targetLevel);

    if (!validTabs.includes(this.activeTab)) {
      this.activeTab = 'Pending';
    }

    this.fetchWorkflowApplications();
  }

  selectTab(tab: WorkflowTab): void {
    this.activeTab = tab;
    this.fetchWorkflowApplications();
  }

  refreshList(): void {
    if (this.workflowEnabled) this.fetchWorkflowApplications();
    else this.fetchAllApplications(this.filters.Status);
  }

  private legacyStatusForCurrentView(): number {
    switch (this.activeTab) {
      case 'PermitDsc': return 5;
      case 'Issued': return 14;
      case 'Rejected': return 4;
      default: return 1;
    }
  }

  fetchWorkflowApplications(): void {
    if (!this.activeLevelId && this.myLevels.length > 0) {
      this.activeLevelId = this.myLevels[0].LevelId;
    }
    if (!this.activeLevelId) {
      this.applications = [];
      return;
    }
    this.loader = true;
    this.applications = [];
    this.selectedUserType = this.filters.userType;
    this.filters.Status = this.legacyStatusForCurrentView();
    this.saveLastView();

    const payload: any = Object.fromEntries(
      Object.entries(this.filters).filter(([key, value]) => value != null && key !== 'Status')
    );

    forkJoin({
      queue: this.approvalWorkflowService.getQueue(this.activeLevelId, this.activeTab).pipe(
        catchError(err => {
          if (err.status === 409) {
            sessionStorage.removeItem(this.lastViewStorageKey);
          }
          this.toastService.show(err?.error?.message || 'Unable to load level queue.', { class: 'danger' });
          return of({ Items: [] as WorkflowQueueItem[], PreviousLevelName: null } as any);
        })
      ),
      apps: this.Officeservice.getAllApplications(payload).pipe(catchError(() => of([])))
    }).subscribe(({ queue, apps }) => {
      this.previousLevelName = queue?.PreviousLevelName || null;
      const queueItems = Array.isArray(queue?.Items) ? queue.Items : [];
      const fullList = this.groupDataByDetailId(Array.isArray(apps) ? apps : []);

      // Strict workflow rule: sirf current level ki queue wali applications hi show hongi
      this.applications = queueItems
        .map((qItem: WorkflowQueueItem) => {
          const fullApp = fullList.find(a => Number(a.AppId) === Number(qItem.AppId));
          return fullApp ? { ...fullApp, Workflow: qItem } : null;
        })
        .filter((item): item is any => item !== null);

      this.loader = false;
      this.cdr.detectChanges();
    });
  }

  workflowStatusBadge(app: any): { text: string; css: string } {
    const s = Number(app?.Status);
    const st = this.wfContext?.Statuses;
    if (st) {
      if (s === st.FinalApprovedStatusId || s === st.PermitGeneratedStatusId) {
        // Step 1 Digital Sign → Step 2 Generate Permit
        const signed = app?.Workflow?.DscCompleted ?? (app?.IsDscSigned === true || app?.IsDscSigned === 1);
        return signed
          ? { text: 'Step 2: Generate Permit pending', css: 'bg-info text-dark' }
          : { text: 'Step 1: Digital Sign pending', css: 'bg-warning text-dark' };
      }
      if (s === st.IssuedStatusId) return { text: 'Issued', css: 'bg-success' };
      if (s === st.RejectedStatusId) return { text: 'Rejected', css: 'bg-danger' };
    }
    const stage = app?.Workflow?.CurrentStage;
    return stage ? { text: stage, css: 'bg-secondary' } : { text: '-', css: 'bg-light text-dark' };
  }

  private saveLastView(): void {
    try {
      sessionStorage.setItem(this.lastViewStorageKey, JSON.stringify({ levelId: this.activeLevelId, tab: this.activeTab }));
    } catch { }
  }

  private readLastView(): { levelId: number; tab: WorkflowTab } | null {
    try {
      const raw = sessionStorage.getItem(this.lastViewStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  loadDistrictMasterLookup(): void {
    this.stockService.getDistricts().subscribe({
      next: (data: any[]) => {
        if (data && data.length > 0) {
          data.forEach((dist: any) => {
            const id = dist.dist_Id || dist.dist_id || dist.Dist_Id;
            const name = dist.dist_Name || dist.dist_name || dist.Dist_Name;
            if (id && name) {
              this.districtLookup[Number(id)] = name;
            }
          });
        }
      },
      error: () => console.error('Failed loading district masters.')
    });
  }

  resolveDistrictName(app: any): string {
    if (!app) return '-';
    if (app.DistrictName || app.Dist_Name || app.districtName) {
      return app.DistrictName || app.Dist_Name || app.districtName;
    }
    if (app.District && isNaN(Number(app.District)) && String(app.District).trim() !== '') {
      return app.District;
    }
    const distId = Number(app.District);
    if (distId && this.districtLookup[distId]) {
      return this.districtLookup[distId];
    }
    const match = (app.Address || '').match(/District\s*-\s*([^,()]+)/i);
    return match ? match[1].trim() : (app.District || '-');
  }

  loadLiquorQuantity(): void {
    this.stockService.getAvailableLiquorQuantity().subscribe({
      next: (response: any) => {
        response.Data.forEach((item: any) => {
          const type = item.EalTypeName;
          if (this.availableLiquorQuantity.hasOwnProperty(type)) {
            this.availableLiquorQuantity[type] = item.AvailableQuantity;
          }
        });
      },
      error: (error) => console.error('Error fetching liquor quantities:', error)
    });
  }

  loadEalTypes(): void {
    this.stockService.ealtypes().subscribe({
      next: (eals) => this.ealTypes = eals,
      error: (error) => console.error('Error fetching ealtypes:', error)
    });
  }

  loadStatusMasters(): void {
    this.applicationFormService.getStatusMasters().subscribe({
      next: (response) => this.allStatus = response,
      error: (error) => console.error('Error fetching status masters:', error)
    });
  }

  onUserTypeChange() {
    this.selectedUserType = this.filters.userType;
    this.applications = [];
    this.refreshList();
  }

  openHandoverOtpModal(app: any) {
    this.selectedAppForOtp = app;
    this.enteredReceivingOtp = '';
    const modalEl = document.getElementById('handoverOtpModal');
    if (modalEl) {
      new bootstrap.Modal(modalEl).show();
    }
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

  isHandoverVerified(app: any): boolean {
    if (!app || !app.AppId) return false;
    const localVerified = localStorage.getItem(`handover_${app.AppId}`) === 'true';
    const apiVerified = app.IsHandoverVerified === true || app.IsHandoverVerified === 1 || app.DeliveryStatus === 'Completed' || app.HandoverDate != null;
    return localVerified || apiVerified;
  }

  sendReceivingOtpModal() {
    if (!this.selectedAppForOtp || !this.selectedAppForOtp.AppId) {
      this.toastService.show('Application data missing!', { class: 'danger' });
      return;
    }
    this.Officeservice.sendReceivingOtp({ AppId: Number(this.selectedAppForOtp.AppId) }).subscribe({
      next: (res: any) => this.toastService.show(res.message || 'OTP sent successfully', { class: 'success' }),
      error: (err: any) => this.toastService.show(err.error?.message || 'Failed to send OTP', { class: 'danger' })
    });
  }

  verifyReceivingOtpModal(): void {
    if (!this.selectedAppForOtp || !this.selectedAppForOtp.AppId) {
      this.toastService.show('Application data missing!', { class: 'danger' });
      return;
    }
    if (!this.enteredReceivingOtp || this.enteredReceivingOtp.trim().length !== 6) {
      this.toastService.show('Please enter a valid 6-digit OTP', { class: 'danger' });
      return;
    }
    const appId = Number(this.selectedAppForOtp.AppId);
    this.Officeservice.verifyReceivingOtp({ AppId: appId, Otp: this.enteredReceivingOtp.trim() }).subscribe({
      next: (res: any) => {
        this.toastService.show(res.message || 'Receiving OTP verified successfully.', { class: 'success' });
        localStorage.setItem(`handover_${appId}`, 'true');
        if (this.selectedAppForOtp) {
          this.selectedAppForOtp.DeliveryStatus = 'Completed';
          this.selectedAppForOtp.HandoverDate = new Date().toISOString();
          this.selectedAppForOtp.IsHandoverVerified = true;
        }
        const index = this.applications.findIndex((x: any) => Number(x.AppId) === appId);
        if (index !== -1) {
          this.applications[index] = { ...this.applications[index], DeliveryStatus: 'Completed', HandoverDate: new Date().toISOString(), IsHandoverVerified: true };
        }
        this.closeHandoverOtpModal();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.toastService.show(err.error?.message || 'Invalid or expired OTP', { class: 'danger' });
      }
    });
  }

  fetchAllApplications(status: any): void {
    this.loader = true;
    this.applications = [];
    this.filters['Status'] = Number(status);
    this.selectedUserType = this.filters.userType;

    const payload = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value != null)
    );

    this.Officeservice.getAllApplications(payload).subscribe({
      next: (data) => {
        const fullList = this.groupDataByDetailId(data);
        if (Number(status) === 14) {
          this.applications = fullList.filter(app => Number(app.Status) === 14 || app.Status === '14' || app.IsDscSigned === true || app.IsDscSigned === 1 || (app.IssuePermitNo && app.IssuePermitNo !== '-' && app.IssuePermitNo !== ''));
        } else if (Number(status) === 6) {
          this.applications = fullList.filter(app => Number(app.Status) === 6 || app.Status === '6');
        } else if (Number(status) === 5) {
          this.applications = fullList.filter(app => Number(app.Status) === 5 || app.Status === '5');
        } else {
          this.applications = fullList.filter(app => Number(app.Status) === Number(status));
        }
        this.loader = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.applications = [];
        this.loader = false;
        this.cdr.detectChanges();
      }
    });
  }

  groupDataByDetailId(data: any[]): any[] {
    return (data || []).map(app => {
      const groupedData = { req_cl_plain_qty: 0, req_cl_masala_qty: 0, req_fl_spirit_qty: 0, req_fl_malt_qty: 0, req_hotel_bar_qty: 0 };
      if (app.ApplicationDetails && Array.isArray(app.ApplicationDetails)) {
        app.ApplicationDetails.forEach((detail: any) => {
          groupedData.req_cl_plain_qty += Number(detail.req_cl_plain_qty || 0);
          groupedData.req_cl_masala_qty += Number(detail.req_cl_masala_qty || 0);
          groupedData.req_fl_spirit_qty += Number(detail.req_fl_spirit_qty || 0);
          groupedData.req_fl_malt_qty += Number(detail.req_fl_malt_qty || 0);
          groupedData.req_hotel_bar_qty += Number(detail.req_hotel_bar_qty || 0);
        });
      }
      return { ...app, groupedData };
    });
  }

  onActionClick(selectedApplicationValue: any) {
    const appId = selectedApplicationValue.AppId ?? selectedApplicationValue.appId ?? selectedApplicationValue.Id ?? selectedApplicationValue.id;
    if (!appId) {
      this.toastService.show('Application ID missing!', { class: 'danger' });
      return;
    }

    let demandDataObject: any[] = [];
    let demandDataObjectViewMode: any[] = [];

    if (selectedApplicationValue.ApplicationDetails) {
      selectedApplicationValue.ApplicationDetails.forEach((d: any) => {
        const typeMapping: { [key: string]: string } = { '1': 'req_fl_spirit_qty', '2': 'req_fl_malt_qty', '3': 'req_cl_plain_qty', '4': 'req_cl_masala_qty', '5': 'req_hotel_bar_qty' };
        const matchedType = this.ealTypes.find(t => t.Id == d.EALType);
        if (matchedType && typeMapping[d.EALType]) {
          demandDataObject.push({ type: `${matchedType.Type} (${matchedType.Code})`, qty: `${d[typeMapping[d.EALType]]}`, id: `${d.EALType}`, detailId: `${d.DetailId}` });
          let quantity = d.EALType == '1' ? d.Approve_fl_spirit_qty : d.EALType == '2' ? d.Approve_fl_malt_qty : d.EALType == '3' ? d.Approve_cl_plain_qty : d.EALType == '4' ? d.Approve_cl_masala_qty : d.Approve_hotel_bar_qty;
          demandDataObjectViewMode.push({ type: `${matchedType.Type} (${matchedType.Code})`, qty: `${d[typeMapping[d.EALType]]}`, id: `${d.EALType}`, detailId: `${d.DetailId}`, assignedQuantity: quantity });
        }
      });
    }

    const updatedApplicationValue = {
      ...selectedApplicationValue,
      AppId: appId,
      DemandDataObject: demandDataObject,
      DemandDataObjectViewMode: demandDataObjectViewMode,
      StatusName: this.allStatus.find(t => t.Status_Id == selectedApplicationValue.Status),
      WorkflowView: this.workflowEnabled ? { levelId: this.activeLevelId, tab: this.activeTab } : null
    };

    this.Officeservice.setSelectedOfficeSupplierApplication(updatedApplicationValue);
    this.route.navigate(['/office-application', appId]);
  }

  previewPermit(app: any): void { this.fetchSignedOrGeneratedPdf(app, 'preview'); }
  printPermit(app: any): void { this.fetchSignedOrGeneratedPdf(app, 'print'); }
  downloadPermit(app: any): void { this.fetchSignedOrGeneratedPdf(app, 'download'); }

  private fetchSignedOrGeneratedPdf(app: any, mode: 'preview' | 'print' | 'download'): void {
    const appId = Number(app.AppId ?? app.appId ?? app.Id ?? 0);
    const fileName = `Permit_${app.EalApplicationNo ? app.EalApplicationNo.replace(/\//g, '_') : appId}.pdf`;
    const isIssuedOrSigned = Number(this.filters.Status) === 14 || app.IsDscSigned === true || app.IsDscSigned === 1;

    if (isIssuedOrSigned) {
      // Served by the API: the generated permit document when available, otherwise the signed document.
      const signedUrl = this.pdfSignService.getSignedPdfUrl(appId);
      const token = sessionStorage.getItem('auth_token') || sessionStorage.getItem('token') || localStorage.getItem('token') || '';
      fetch(signedUrl, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => { if (!res.ok) throw new Error('Permit document not found'); return res.blob(); })
        .then(blob => this.openPdfBlobInViewer(blob, mode === 'print', mode === 'download' ? `Signed_${fileName}` : undefined))
        .catch(() => this.toastService.show('Permit document not found.', { class: 'danger' }));
    }
  }

  private openPdfBlobInViewer(blob: Blob, autoPrint: boolean = false, downloadName?: string): void {
    const pdfBlob = new Blob([blob], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(pdfBlob);
    if (downloadName) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    const viewerWin = window.open(blobUrl, '_blank');
    if (viewerWin && autoPrint) {
      viewerWin.onload = () => { setTimeout(() => viewerWin.print(), 500); };
    }
  }

  fillFinancialYears(): void {
    const cur = new Date().getFullYear();
    const m = new Date().getMonth();
    const yr = m < 3 ? cur - 1 : cur;
    this.currentFinancialYear = `${yr}-${yr + 1}`;
    this.filters.FinancialYear = this.currentFinancialYear;
  }

  loadAllMonths(): void {
    this.stockService.getAllMonths().subscribe({ next: (m) => this.allMonths = m });
  }

  resetFilters() {
    this.filters = { FinancialYear: this.currentFinancialYear, Month: null, DateFrom: null, DateTo: null, userType: 'FL', Status: 1, EALType: null, Search: null };
    if (this.workflowEnabled) this.fetchWorkflowApplications();
    else this.fetchAllApplications(1);
  }
}