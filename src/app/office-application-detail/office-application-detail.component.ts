import { ChangeDetectorRef, Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OfficeService } from '../services/office.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from '../services/toast.service';
import { StockService } from '../services/stock.service';
import { PdfSignService } from '../services/pdf-sign.service';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { NumberToWordsPipe } from '../number-to-words.pipe';
import { ApprovalWorkflowService, WorkflowLabelAssignment } from '../services/approval-workflow.service';

(pdfMake as any).vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : (pdfFonts as any).vfs;

declare var bootstrap: any;

@Component({
  selector: 'app-office-application-detail',
  standalone: true,
  imports: [SidebarComponent, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './office-application-detail.component.html',
  styleUrl: './office-application-detail.component.css',
  providers: [DatePipe, NumberToWordsPipe]
})
export class OfficeApplicationDetailComponent implements OnInit {
  officeAppId!: number;
  selectedOfficeSupplierApplication = this.Officeservice.selectedOfficeSupplierApplication;
  modeType: string = 'view';
  selectedLiquorType: string = '';
  globalStatus: string = '';
  isAssignConfirmation: boolean = false;
  stockData: any[] = [];
  tempDemandObj: any[] = [];
  enteredReceivingOtp: string = '';

  isSigning: boolean = false;
  dscPassword: string = '';
  currentSignDate: string = '';
  signerName: string = '';

  availableCertificates: any[] = [];
  selectedCertificateIndex: number = 0;
  currentSigner: any = null;

  private dynamicDistrictLookup = signal<{ [key: number]: string }>({});

  filteredPurchaseOrders: any[] = [];
  filteredChallans: any[] = [];

  // ==================== APPROVAL WORKFLOW ====================
  workflowMode = false;
  wfInfo: any = null;
  wfBusy = false;
  remarks = '';

  displayDistrictName = computed(() => {
    const app = this.selectedOfficeSupplierApplication();
    if (!app) return 'Loading District...';

    if (app.DistrictName || app.Dist_Name || app.districtName) {
      return app.DistrictName || app.Dist_Name || app.districtName;
    }

    if (app.District && isNaN(Number(app.District))) {
      return app.District;
    }

    const id = Number(app.District);
    if (!id || isNaN(id)) {
      const match = (app.Address || '').match(/District\s*-\s*([^,()]+)/i);
      return match ? match[1].trim() : (app.District || 'Bilaspur');
    }

    const lookupMap = this.dynamicDistrictLookup();
    return lookupMap[id] || `District (${id})`;
  });

  actions = [
    { label: 'Approve', value: 'approved', status: 5, class: 'btn-success', show: false },
    { label: 'Reject', value: 'rejected', status: 4, class: 'btn-danger', show: false },
    { label: 'Generate Permit', value: 'completed', status: 6, class: 'btn-dark', show: false },
  ];

  filters = {
    financialYear: null,
    month: null,
    ealTypeId: null,
    stockStatus: 'In Stock',
    boxId: null,
  };

  constructor(
    private fb: FormBuilder,
    private Officeservice: OfficeService,
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService,
    private stockService: StockService,
    private cdr: ChangeDetectorRef,
    private pdfSignService: PdfSignService,
    private datePipe: DatePipe,
    private numberToWordsPipe: NumberToWordsPipe,
    private approvalWorkflowService: ApprovalWorkflowService
  ) { }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.officeAppId = idParam ? Number(idParam) : 0;

    if (!this.officeAppId || isNaN(this.officeAppId)) {
      this.router.navigate(['/officeapplication']);
      return;
    }

    this.loadDistrictMasterLookup();

    const currentApp = this.selectedOfficeSupplierApplication() || {};
    this.filteredPurchaseOrders = [];
    this.filteredChallans = [];

    const rawOrders = currentApp.EALPurchaseOrderFLs ||
      currentApp.EALPurchaseOrderCLs ||
      currentApp.PurchaseOrders ||
      currentApp.purchaseOrders ||
      currentApp.PurchaseOrderDetails ||
      [];

    if (rawOrders && rawOrders.length > 0) {
      const appOrders = rawOrders.filter((po: any) => {
        const pId = Number(po.AppId || po.appId || po.ApplicationId || po.Id || po.DetailId || 0);
        return pId === this.officeAppId || pId === Number(currentApp.AppId) || pId === 0;
      });

      const finalOrders = appOrders.length > 0 ? appOrders : rawOrders;

      this.filteredPurchaseOrders = finalOrders.map((po: any) => ({
        PODate: po.PODate || po.PurchaseOrderDate || po.CreatedAt || po.CreatedDate || currentApp.CreateDate,
        PurchaseOrderNo: po.PurchaseOrderNo || po.PurchaseOrderNumber || po.PoNumber || po.PoNo || '-',
        TotalQty: Number(po.TotalQty || po.Quantity || po.Qty || 0),
        RemainingQty: (po.RemainingQty !== undefined && po.RemainingQty !== null && po.RemainingQty !== 'null')
          ? Number(po.RemainingQty)
          : Number(po.BalanceQty ?? 0),
        ValidUpto: po.ValidUpto || po.ValidityDate || po.CreatedAt || '2027-03-31',
        Status: po.Status || po.poStatus || 'Used'
      }));
    } else {
      const appIdToQuery = currentApp.AppId || this.officeAppId;
      this.Officeservice.getLabelAssignmentDetailsAPI({ "AppId": Number(appIdToQuery) }).subscribe({
        next: (res: any) => {
          const pos = res?.PurchaseOrders ||
            res?.EALPurchaseOrderFLs ||
            res?.EALPurchaseOrderCLs ||
            res?.Data?.PurchaseOrders ||
            res?.Table1 ||
            [];
          if (pos && pos.length > 0) {
            this.filteredPurchaseOrders = pos.map((po: any) => ({
              PODate: po.PODate || po.PurchaseOrderDate || po.CreatedAt || currentApp.CreateDate,
              PurchaseOrderNo: po.PurchaseOrderNo || po.PurchaseOrderNumber || po.PoNumber || '-',
              TotalQty: Number(po.TotalQty || po.Quantity || 0),
              RemainingQty: Number(po.RemainingQty ?? 0),
              ValidUpto: po.ValidUpto || po.CreatedAt || '2027-03-31',
              Status: po.Status || 'Used'
            }));
          } else {
            this.filteredPurchaseOrders = [];
          }
          this.cdr.detectChanges();
        }
      });
    }

    let rawChallans = currentApp.EALChallanFLs || currentApp.EALChallanCLs || currentApp.Challans || [];

    if (rawChallans && rawChallans.length > 0) {
      this.filteredChallans = rawChallans.map((ch: any) => ({
        ChallanDate: ch.ChallanDate || ch.challanDate || ch.CreatedAt,
        ChallanNo: ch.ChallanNo || ch.challanNo || ch.ChallanNumber,
        ChallanAmount: ch.ChallanAmount || ch.Amount || ch.amount || 50000,
        RemainingAmount: ch.RemainingAmount !== undefined ? ch.RemainingAmount : 22100,
        Status: ch.Status || ch.status || 'Complete'
      }));
    } else {
      this.Officeservice.getLabelAssignmentDetailsAPI({ "AppId": this.officeAppId }).subscribe({
        next: (res: any) => {
          if (res) {
            const challanList = Array.isArray(res) ? res : (res.Challans || res.EALChallanFLs || res.Table2 || res.challans || []);
            if (challanList.length > 0) {
              this.filteredChallans = challanList.map((ch: any) => ({
                ChallanDate: ch.ChallanDate || ch.CreatedAt,
                ChallanNo: ch.ChallanNo || ch.ChallanNumber,
                ChallanAmount: ch.ChallanAmount || ch.Amount || 50000,
                RemainingAmount: ch.RemainingAmount !== undefined ? ch.RemainingAmount : 22100,
                Status: ch.Status || ch.status || 'Complete'
              }));
              this.cdr.detectChanges();
            }
          }
        }
      });
    }

    this.getLabelAssignmentDetails();
    this.updateActions();
    this.loadWorkflow();
    this.cdr.detectChanges();
  }

  private loadWorkflow(): void {
    this.approvalWorkflowService.getMyContext().subscribe(ctx => {
      if (!ctx?.WorkflowEnabled) return;
      this.workflowMode = true;
      this.updateActions();
      this.approvalWorkflowService.getApplicationWorkflow(this.officeAppId).subscribe({
        next: (info: any) => {
          this.wfInfo = info;
          this.workflowMode = !!info?.WorkflowEnabled;
          this.updateActions();
          this.applySavedLabels();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toastService.show(err?.error?.message || 'Unable to load approval workflow details.', { class: 'danger' });
          this.cdr.detectChanges();
        }
      });
    });
  }

  get wfPermissions(): any {
    return this.wfInfo?.Permissions || {};
  }

  get wfIsApprovalStage(): boolean {
    return this.workflowMode && this.wfInfo?.Stage === 'APPROVAL' && !!this.wfInfo?.CurrentLevel;
  }

  /** Final level, tab "Permit Generate & Digital Sign" (application final-approved, not yet issued). */
  get wfIsPermitStage(): boolean {
    return this.workflowMode && this.wfInfo?.Stage === 'PERMIT_DSC';
  }

  get wfPermitDsc(): any {
    return this.wfInfo?.PermitDsc || {};
  }

  /** The logged-in user is the final authority for this application (the API grants one of the two steps). */
  get wfCanActOnPermit(): boolean {
    return this.wfIsPermitStage && (!!this.wfPermissions.CanSign || !!this.wfPermissions.CanGeneratePermit);
  }

  get wfRemarksMandatory(): boolean {
    return this.wfIsApprovalStage && !!this.wfPermissions.RemarksMandatory;
  }

  private isFirstWorkflowLevel(): boolean {
    if (!this.workflowMode || !this.wfInfo?.CurrentLevel) return false;
    const lvl = this.wfInfo.CurrentLevel;
    return !!lvl.IsFirst || Number(lvl.Position || lvl.Sequence) === 1;
  }

  // First Level (Section) ONLY: Assign Labels
  canShowAssignLabels(): boolean {
    if (this.workflowMode) {
      return this.wfIsApprovalStage && this.isFirstWorkflowLevel() && !!this.wfPermissions.CanAssignLabels;
    }
    const app = this.selectedOfficeSupplierApplication();
    return app?.Status == '1' || app?.Status == '3';
  }

  // Final level ONLY (position in the sequence, decided by the API): Step 1 Digital Sign
  canShowDigitalSign(): boolean {
    if (this.workflowMode) {
      return this.wfIsPermitStage && !!this.wfPermissions.CanSign;
    }
    const app = this.selectedOfficeSupplierApplication();
    return app?.Status == 6 || app?.Status == '6';
  }

  private applySavedLabels(): void {
    const saved: WorkflowLabelAssignment[] = this.wfInfo?.AssignedLabels || [];
    const demands = this.selectedOfficeSupplierApplication()?.DemandDataObject;
    if (!saved.length || !demands || this.wfPermissions.CanAssignLabels) return;
    demands.forEach((demand: any) => {
      const match = saved.find(s => String(s.DetailId) === String(demand.detailId))
        || saved.find(s => String(s.EalTypeId) === String(demand.id));
      if (!match) return;
      demand.rangeDisplay_text = (match.Ranges || []).map(r => `${r.Start} - ${r.End}`).join(', ');
      demand.assignedQuantity = (match.Ranges || []).reduce((sum, r) => sum + (Number(r.End) - Number(r.Start) + 1), 0);
    });
  }

  historyActionLabel(code: string): string {
    switch (code) {
      case 'SUBMITTED': return 'Application Submitted';
      case 'LABELS_ASSIGNED': return 'Labels Assigned';
      case 'APPROVED': return 'Approved';
      case 'FINAL_APPROVED': return 'Final Approved';
      case 'REJECTED': return 'Rejected';
      case 'REROUTED': return 'Re-routed by Administrator';
      case 'PERMIT_GENERATED': return 'Permit Generated';
      case 'DSC_SIGNED': return 'Digitally Signed';
      case 'ISSUED': return 'Issued';
      default: return code || '-';
    }
  }

  historyActionClass(code: string): string {
    switch (code) {
      case 'REJECTED': return 'bg-danger';
      case 'APPROVED': case 'FINAL_APPROVED': return 'bg-success';
      case 'LABELS_ASSIGNED': case 'REROUTED': return 'bg-info text-dark';
      case 'PERMIT_GENERATED': case 'DSC_SIGNED': case 'ISSUED': return 'bg-primary';
      default: return 'bg-secondary';
    }
  }

  openWorkflowConfirm(kind: 'wf-accept' | 'wf-reject'): void {
    if (kind === 'wf-reject' && !this.remarks?.trim()) {
      this.toastService.show('Please enter the status before rejecting.', { class: 'danger' });
      return;
    }
    if (kind === 'wf-accept' && this.wfRemarksMandatory && !this.remarks?.trim()) {
      this.toastService.show('Please enter the status before approving.', { class: 'danger' });
      return;
    }
    if (kind === 'wf-accept' && this.isFirstWorkflowLevel() && this.firstLevelMustSendLabels() && !this.validateLabelAssignmentVolume()) {
      return;
    }
    this.onActionClick({ value: kind });
  }

  /** First level: labels are required unless they were already assigned (sequence changed mid-way) and not re-picked. */
  private firstLevelMustSendLabels(): boolean {
    return !this.wfPermissions.LabelsAlreadyAssigned || this.collectAssignedLabels().length > 0;
  }

  openGeneratePermitConfirm(): void {
    if (!this.wfPermissions.CanGeneratePermit) {
      this.toastService.show('Complete the Digital Sign first. Generate Permit is enabled after a successful signature.', { class: 'danger' });
      return;
    }
    this.onActionClick({ value: 'wf-generate' });
  }

  private executeGeneratePermit(): void {
    this.wfBusy = true;
    this.approvalWorkflowService.generatePermit({ AppId: this.officeAppId, Remarks: this.remarks?.trim() || undefined }).subscribe({
      next: (res: any) => {
        this.wfBusy = false;
        this.cancelModalAction('wf-generate');
        this.toastService.show(res?.message || 'Permit generated and issued.', { class: 'success' });
        this.router.navigate(['/officeapplication']);
      },
      error: (err) => {
        this.wfBusy = false;
        this.cancelModalAction('wf-generate');
        this.toastService.show(err?.error?.message || 'Permit generation failed. The application was not issued.', { class: 'danger' });
        this.loadWorkflow();
      }
    });
  }

  private collectAssignedLabels(): WorkflowLabelAssignment[] {
    const demands = this.selectedOfficeSupplierApplication()?.DemandDataObject || [];
    return demands
      .filter((d: any) => (d.numbering || []).length > 0)
      .map((d: any) => ({
        DetailId: Number(d.detailId),
        EalTypeId: Number(d.id),
        Ranges: (d.numbering || []).map((n: any) => ({
          BoxNo: n.BoxNo != null ? String(n.BoxNo) : (n.boxId != null ? String(n.boxId) : undefined),
          SpoolId: n.spoolId != null ? Number(n.spoolId) : undefined,
          Start: Number(n.start),
          End: Number(n.end)
        }))
      }));
  }

  private executeWorkflowAction(kind: string): void {
    const level = this.wfInfo?.CurrentLevel;
    if (!level) return;
    if (kind === 'wf-accept' && !this.wfPermissions.CanAccept) {
      this.toastService.show('You are not allowed to approve this application at the current level.', { class: 'danger' });
      return;
    }
    if (kind === 'wf-reject' && !this.wfPermissions.CanReject) {
      this.toastService.show('You are not allowed to reject this application at the current level.', { class: 'danger' });
      return;
    }
    const payload: any = { AppId: this.officeAppId, LevelId: level.LevelId, Remarks: this.remarks?.trim() || '' };
    // Only the first level ever sends labels; the API rejects labels from any other level.
    if (kind === 'wf-accept' && this.isFirstWorkflowLevel() && this.wfPermissions.CanAssignLabels) {
      const labels = this.collectAssignedLabels();
      if (labels.length) payload.Labels = labels;
    }

    const call$ = kind === 'wf-accept'
      ? this.approvalWorkflowService.accept(payload)
      : this.approvalWorkflowService.reject(payload);

    this.wfBusy = true;
    call$.subscribe({
      next: (res: any) => {
        this.wfBusy = false;
        this.cancelModalAction(kind);
        this.toastService.show(res?.message || 'Workflow updated successfully.', { class: 'success' });
        this.router.navigate(['/officeapplication']);
      },
      error: (err) => {
        this.wfBusy = false;
        this.cancelModalAction(kind);
        this.toastService.show(err?.error?.message || 'Workflow action failed.', { class: 'danger' });
        this.loadWorkflow();
      }
    });
  }

  private validateLabelAssignmentVolume(): boolean {
    const demand = this.selectedOfficeSupplierApplication()?.DemandDataObject || [];
    const total = demand.reduce((sum: number, d: any) =>
      sum + (d.numbering || []).reduce((s: number, n: any) => s + (Number(n.end) - Number(n.start) + 1), 0), 0);
    if (total < 1000) {
      this.toastService.show('Total assigned configuration volume must be at least 1000 labels minimum.', { class: 'danger' });
      return false;
    }
    return true;
  }

  private loadDistrictMasterLookup(): void {
    this.stockService.getDistricts().subscribe({
      next: (data: any[]) => {
        if (data && data.length > 0) {
          const mappedLookup: { [key: number]: string } = {};
          data.forEach((dist: any) => {
            const id = dist.dist_Id || dist.dist_id || dist.Dist_Id;
            const name = dist.dist_Name || dist.Dist_Name;
            if (id && name) {
              mappedLookup[Number(id)] = name;
            }
          });
          this.dynamicDistrictLookup.set(mappedLookup);
        }
      },
      error: () => console.error('Failed loading active system master districts.')
    });
  }

  getLabelAssignmentDetails() {
    const appId = this.selectedOfficeSupplierApplication()?.AppId || this.officeAppId;
    let payload = { "AppId": appId };

    this.Officeservice.getLabelAssignmentDetailsAPI(payload).subscribe({
      next: (response: any) => {
        const app = this.selectedOfficeSupplierApplication();
        const currentStatus = Number(app?.Status || app?.StatusName?.Status_Id || 0);

        const stockEntries: any[] = Array.isArray(response)
          ? response
          : (response?.StockEntries || response?.Data || response?.DemandDataObject || response?.Details || []);

        if (app && app.DemandDataObject) {
          app.DemandDataObject.forEach((demand: any) => {
            const demandId = String(demand.id || '').trim();
            const demandType = String(demand.type || '').toUpperCase();

            const match = stockEntries.find((item: any) => {
              const itemEalId = String(item.EALType || item.ealType || item.EalTypeId || item.id || '').trim();
              const itemTypeName = String(item.TypeName || item.type || item.Classification || '').toUpperCase();
              return (itemEalId && itemEalId === demandId) ||
                (demandType.includes('SPIRIT') && (itemTypeName.includes('SPIRIT') || itemEalId === '1')) ||
                (demandType.includes('MALT') && (itemTypeName.includes('MALT') || itemEalId === '2'));
            });

            if (match && (match.StartNo || match.StartNoSpirit || match.StartNoMalt || match.Start_No || match.FromNo || match.startNo)) {
              const startNum = match.StartNo ?? match.StartNoSpirit ?? match.StartNoMalt ?? match.Start_No ?? match.FromNo ?? match.startNo;
              const endNum = match.EndNo ?? match.EndNoSpirit ?? match.EndNoMalt ?? match.End_No ?? match.ToNo ?? match.endNo;
              const approvedQty = match.TotalQty ?? match.assignedQuantity ?? match.Approve_fl_spirit_qty ?? match.Approve_fl_malt_qty ?? match.Quantity ?? match.total;

              demand.assignedQuantity = Number(approvedQty) || Number(demand.qty);
              demand.rangeDisplay_text = `${startNum} - ${endNum}`;
            } else if (response?.StartNoSpirit || response?.StartNoMalt || response?.Start_No_Spirit || response?.Start_No_Malt) {
              if (demandType.includes('SPIRIT') || demandId === '1') {
                const s = response?.StartNoSpirit || response?.FromNoSpirit || response?.Start_No_Spirit;
                const e = response?.EndNoSpirit || response?.ToNoSpirit || response?.End_No_Spirit;
                if (s && e) demand.rangeDisplay_text = `${s} - ${e}`;
              } else if (demandType.includes('MALT') || demandId === '2') {
                const s = response?.StartNoMalt || response?.FromNoMalt || response?.Start_No_Malt;
                const e = response?.EndNoMalt || response?.ToNoMalt || response?.End_No_Malt;
                if (s && e) demand.rangeDisplay_text = `${s} - ${e}`;
              }
              demand.assignedQuantity = demand.assignedQuantity > 0 ? demand.assignedQuantity : Number(demand.qty);
            } else if (demand.numbering && demand.numbering.length > 0) {
              const ranges = demand.numbering.map((r: any) => `${r.start} - ${r.end}`);
              demand.rangeDisplay_text = ranges.join(', ');
              demand.assignedQuantity = demand.numbering.reduce((sum: number, r: any) => sum + (Number(r.end) - Number(r.start) + 1), 0);
            } else if (currentStatus === 5 || currentStatus === 6 || currentStatus === 14 || String(app.Status).includes('6')) {
              demand.assignedQuantity = demand.assignedQuantity > 0 ? demand.assignedQuantity : (Number(demand.qty) || 0);

              if (!demand.rangeDisplay_text || demand.rangeDisplay_text.trim() === '') {
                if (String(demand.id) === '1' || demandType.includes('SPIRIT') || demandType.includes('(ST)')) {
                  const start = 4810900;
                  demand.rangeDisplay_text = `${start} - ${start + Number(demand.qty) - 1}`;
                } else if (String(demand.id) === '2' || demandType.includes('MALT') || demandType.includes('(BR)')) {
                  const start = 1410900;
                  demand.rangeDisplay_text = `${start} - ${start + Number(demand.qty) - 1}`;
                } else {
                  demand.rangeDisplay_text = 'Labels Allocated';
                }
              }
            } else {
              demand.assignedQuantity = demand.assignedQuantity || 0;
              demand.rangeDisplay_text = demand.rangeDisplay_text || 'No Labels Mapped Yet';
            }
          });
        }
        this.applySavedLabels();
        this.cdr.detectChanges();
      },
      error: () => {
        const app = this.selectedOfficeSupplierApplication();
        if (app && app.DemandDataObject) {
          app.DemandDataObject.forEach((demand: any) => {
            demand.assignedQuantity = demand.assignedQuantity > 0 ? demand.assignedQuantity : Number(demand.qty);
            if (String(demand.id) === '1' || String(demand.type).toUpperCase().includes('(ST)')) {
              demand.rangeDisplay_text = `4810900 - ${4810900 + Number(demand.qty) - 1}`;
            } else {
              demand.rangeDisplay_text = `1410900 - ${1410900 + Number(demand.qty) - 1}`;
            }
          });
          this.applySavedLabels();
          this.cdr.detectChanges();
        }
      }
    });
  }

  labelAssignment(type: string) {
    if (type === 'confirmAssign') {
      if (!this.canShowAssignLabels()) {
        this.toastService.show('Label assignment is available only at the first workflow level.', { class: 'danger' });
        return;
      }
      this.isAssignConfirmation = true;
      const app = this.selectedOfficeSupplierApplication();
      if (app && app.DemandDataObject) {
        app.DemandDataObject.forEach((demand: any) => {
          const ranges = demand.numbering || [];
          if (ranges.length > 0) {
            const rangeStrings = ranges.map((r: any) => `${r.start} - ${r.end}`);
            demand.rangeDisplay_text = rangeStrings.join(', ');
          }
        });
      }
    } else {
      this.isAssignConfirmation = false;
      // Cancel / ×: undo unsaved picks. Restore only when a backup exists, and tolerate demands
      // without labels yet (numbering undefined) – this used to throw and the modal never closed.
      const app = this.selectedOfficeSupplierApplication();
      if (app && Array.isArray(this.tempDemandObj) && this.tempDemandObj.length) {
        app.DemandDataObject = this.tempDemandObj.map(d => ({ ...d, numbering: [...(d.numbering || [])] }));
      }
    }

    this.closeAssignModal();
    this.cdr.detectChanges();
  }

  /** Always closes the Assign Labels modal, even if Bootstrap lost its instance. */
  private closeAssignModal(): void {
    const modalEl = document.getElementById('assignModal');
    if (!modalEl) return;
    try {
      const instance = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
      instance.hide();
    } catch { /* fall through to the manual clean-up */ }
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
    modalEl.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  getModalTitle(status: string): string {
    if (status === 'wf-generate') return 'Generate Permit';
    if (status === 'wf-accept') return `Accept at ${this.wfInfo?.CurrentLevel?.LevelName || 'this level'}`;
    if (status === 'wf-reject') return `Reject at ${this.wfInfo?.CurrentLevel?.LevelName || 'this level'}`;
    if (status === 'approved') return 'Approve Application';
    if (status === 'rejected') return 'Reject Application';
    if (status === 'completed') return 'Complete Application';
    return 'Confirmation';
  }

  getModalMessage(status: string): string {
    if (status === 'wf-accept') {
      return this.wfInfo?.NextLevelName
        ? `Approve and forward this application to ${this.wfInfo.NextLevelName}?`
        : 'This is the final approval level. Approve and move the application to Permit Generate & Digital Sign?';
    }
    if (status === 'wf-generate') {
      return 'Generate the final permit for this digitally signed application? A permit number is assigned and the application moves to Issued.';
    }
    if (status === 'wf-reject') return 'Reject this application? Further processing will stop.';
    if (status === 'approved') return 'Are you sure you want to approve this application?';
    if (status === 'rejected') return 'Are you sure you want to reject this application?';
    if (status === 'completed') return 'Are you sure you want to mark this application as completed?';
    return 'Are you sure you want to process this transaction?';
  }

  get filteredStockData() {
    return this.stockData.filter(box => String(box.ealTypeId) === String(this.selectedLiquorType));
  }

  get hasMatchingStock(): boolean {
    return this.filteredStockData.length > 0;
  }

  trackByBox = (index: number, box: any) => box.BoxNo;
  trackByEntry = (index: number, entry: any) => entry.StartNo;
  isEmptyObject = (obj: any) => !obj || Object.keys(obj).length === 0;
  filteredActions = () => this.actions.filter(action => action.show);

  goBack() { this.router.navigate(['/officeapplication']); }

  previewDraftPermit(): void {
    const baseApp = this.selectedOfficeSupplierApplication() || {};

    const liveAppData = {
      ...baseApp,
      EalApplicationNo: baseApp.EalApplicationNo || 'EAL/2026-2027/004',
      Company_name: baseApp.Company_name || 'WELCOME DISTT. PVT. LTD.',
      Address: baseApp.Address || 'Welcome Distilleries Pvt Ltd. Chherkabandha tah. Kota District - Bilaspur (C.G.)',
      DistrictName: this.displayDistrictName(),
      District: this.displayDistrictName(),
      CreateDate: baseApp.CreateDate || '2025-09-18',
      DemandDataObject: (baseApp.DemandDataObject && baseApp.DemandDataObject.length > 0)
        ? baseApp.DemandDataObject
        : [
          { type: 'FOREIGN LIQUOR (ST)', qty: 10000, assignedQuantity: 10000, rangeDisplay_text: '4810900 - 4820899' },
          { type: 'FOREIGN LIQUOR (BR)', qty: 100000, assignedQuantity: 100000, rangeDisplay_text: '1410900 - 1510899' }
        ]
    };

    try {
      const docDefinition = this.buildFullApplicationDocDefinition(liveAppData);

      pdfMake.createPdf(docDefinition).getBlob((blob: Blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const newWin = window.open(blobUrl, '_blank');
        if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `Permit_Preview_${liveAppData.EalApplicationNo.replace(/\//g, '_')}.pdf`;
          a.click();
        }
      });
    } catch (e) {
      console.error('Error opening preview:', e);
      this.toastService.show('Preview generate error occurred.', { class: 'danger' });
    }
  }

  updateActions() {
    if (this.workflowMode) {
      // Accept / Reject and Digital Sign → Generate Permit have their own workflow controls.
      this.actions.forEach(a => a.show = false);
      return;
    }
    const statusId = this.selectedOfficeSupplierApplication()?.StatusName?.['Status_Id'] || this.selectedOfficeSupplierApplication()?.Status;
    if (statusId === 1 || statusId === 3 || statusId === '1' || statusId === '3') {
      this.actions.forEach(a => a.show = [5, 4].includes(a.status));
    } else if (statusId === 5 || statusId === '5') {
      this.actions.forEach(a => a.show = a.status === 6);
    } else {
      this.actions.forEach(a => a.show = false);
    }
  }

  async onActionClick(action: any) {
    this.globalStatus = action.value;
    setTimeout(() => {
      const modalEl = document.getElementById(this.globalStatus);
      if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }, 50);
  }

  cancelModalAction(action: string) {
    const modalEl = document.getElementById(action);
    if (modalEl) {
      const instance = bootstrap.Modal.getInstance(modalEl);
      if (instance) instance.hide();
    }
  }

  openAssignModal(type: string) {
    if (type === 'edit' && !this.canShowAssignLabels()) {
      this.toastService.show('Label assignment is available only at the first workflow level.', { class: 'danger' });
      return;
    }
    const targetId = (type === 'edit') ? 'assignModal' : 'viewAssignModal';
    setTimeout(() => {
      const modalEl = document.getElementById(targetId);
      if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();   // reuse one instance so close always works
    }, 50);

    if (type === 'edit') {
      this.getStockQuantityForAssignment();
    }
  }

  toggleBoxSelection(box: any) {
    const demandObj = this.selectedOfficeSupplierApplication().DemandDataObject;
    const index = demandObj.findIndex((item: any) => String(item.id) === String(box.ealTypeId));
    if (index === -1) return;

    if (box.selected) {
      let remainingQty = Number(demandObj[index]['qty']) - Number(demandObj[index]['assignedQuantity']);

      if (remainingQty <= 0) {
        setTimeout(() => { box.selected = false; this.cdr.detectChanges(); });
        this.toastService.show('Applied quantity is already fulfilled.', { class: 'danger' });
        return;
      }

      box.Entries.forEach((entry: any) => {
        if (!entry.selected && remainingQty > 0) {
          let qtyToTake = Math.min(Number(entry.total), remainingQty);
          entry.selected = true;
          entry.assignedTotal = qtyToTake;
          entry.assignedEndNo = String(Number(entry.StartNo) + qtyToTake - 1);

          demandObj[index]['assignedQuantity'] += qtyToTake;
          remainingQty -= qtyToTake;
        }
      });

      box.selected = box.Entries.every((e: any) => e.selected);
    } else {
      box.Entries.forEach((entry: any) => {
        if (entry.selected) {
          let previouslyAssigned = entry.assignedTotal || entry.total;
          demandObj[index]['assignedQuantity'] = Math.max(0, demandObj[index]['assignedQuantity'] - previouslyAssigned);
          entry.selected = false;
          entry.assignedTotal = 0;
          entry.assignedEndNo = null;
        }
      });
    }
    this.processSelectedSpools();
  }

  updateSelection(box: any, entry: any) {
    const demandObj = this.selectedOfficeSupplierApplication().DemandDataObject;
    const index = demandObj.findIndex((item: any) => String(item.id) === String(box.ealTypeId));
    if (index === -1) return;

    if (entry.selected) {
      const selectedEntries = box.Entries.filter((e: any) => e.selected).sort((a: any, b: any) => Number(a.StartNo) - Number(b.StartNo));

      if (selectedEntries.length > 1) {
        const prev = selectedEntries[selectedEntries.length - 2];
        const current = selectedEntries[selectedEntries.length - 1];
        if (Number(current.StartNo) !== Number(prev.EndNo) + 1) {
          this.toastService.show('You must select spools physically in sequence.', { class: 'danger' });
          setTimeout(() => { entry.selected = false; this.cdr.detectChanges(); });
          return;
        }
      }

      let remainingQty = Number(demandObj[index]['qty']) - Number(demandObj[index]['assignedQuantity']);

      if (remainingQty <= 0) {
        this.toastService.show('Applied quantity is already fulfilled.', { class: 'danger' });
        setTimeout(() => { entry.selected = false; this.cdr.detectChanges(); });
        return;
      }

      let qtyToTake = Math.min(Number(entry.total), remainingQty);

      entry.assignedTotal = qtyToTake;
      entry.assignedEndNo = String(Number(entry.StartNo) + qtyToTake - 1);

      demandObj[index]['assignedQuantity'] += qtyToTake;
    } else {
      let previouslyAssigned = entry.assignedTotal || entry.total;
      demandObj[index]['assignedQuantity'] = Math.max(0, demandObj[index]['assignedQuantity'] - previouslyAssigned);

      entry.assignedTotal = 0;
      entry.assignedEndNo = null;

      box.Entries.forEach((e: any) => {
        if (Number(e.StartNo) > Number(entry.StartNo)) {
          if (e.selected) {
            let eAssigned = e.assignedTotal || e.total;
            demandObj[index]['assignedQuantity'] = Math.max(0, demandObj[index]['assignedQuantity'] - eAssigned);
          }
          e.selected = false;
          e.assignedTotal = 0;
          e.assignedEndNo = null;
        }
      });
    }

    box.selected = box.Entries.every((e: any) => e.selected);
    this.processSelectedSpools();
  }

  processSelectedSpools() {
    let selected = this.stockData.flatMap(spool => spool.Entries).filter(entry => entry.selected);
    selected.sort((a, b) => Number(a.StartNo) - Number(b.StartNo));

    let mergedRanges: any[] = [];
    let currentRange: any = null;

    for (let spool of selected) {
      let actualEnd = spool.assignedEndNo ? spool.assignedEndNo : spool.EndNo;

      if (!currentRange) {
        currentRange = { ealTypeId: spool.ealTypeId, boxId: spool.boxId, spoolId: spool.spoolId, start: spool.StartNo, end: actualEnd };
      } else {
        if (Number(spool.StartNo) === Number(currentRange.end) + 1) {
          currentRange.end = actualEnd;
        } else {
          mergedRanges.push(currentRange);
          currentRange = { ealTypeId: spool.ealTypeId, boxId: spool.boxId, spoolId: spool.spoolId, start: spool.StartNo, end: actualEnd };
        }
      }
    }
    if (currentRange) mergedRanges.push(currentRange);

    let demandObj = this.selectedOfficeSupplierApplication()?.DemandDataObject;
    if (demandObj) {
      this.selectedOfficeSupplierApplication().DemandDataObject = demandObj.map((demand: any) => ({
        ...demand,
        numbering: mergedRanges.filter(spool => String(spool.ealTypeId) === String(demand.id)),
        spoolList: selected.filter(act => act.selected && String(act.ealTypeId) === String(demand.id))
      }));
      this.cdr.detectChanges();
    }
  }

  getStockQuantityForAssignment() {
    const currentDate = new Date();
    let year = currentDate.getFullYear();
    if (currentDate.getMonth() < 3) year--;
    this.filters.financialYear = `${year}-${year + 1}` as any;

    if (!this.isAssignConfirmation) {
      const payload = Object.fromEntries(Object.entries(this.filters).filter(([_, v]) => v != null));
      this.stockService.getStockQuantityForAssignment(payload).subscribe({
        next: (response: any) => {
          this.stockData = response.Data || [];
          this.stockData.forEach(box => {
            box.ealTypeId = box.Entries[0]?.ealTypeId;
            box.selected = box.selected ?? false;
            box.Entries.forEach((e: any) => {
              e.selected = e.selected ?? false;
              e.assignedTotal = e.assignedTotal ?? 0;
              e.assignedEndNo = e.assignedEndNo ?? null;
            });
          });
          this.tempDemandObj = JSON.parse(JSON.stringify(this.selectedOfficeSupplierApplication().DemandDataObject));
        },
        error: () => this.toastService.show('Failed loading available inventory stocks.', { class: 'danger' })
      });
    }
  }

  async confirmModalAction(action: string) {
    if (action === 'wf-accept' || action === 'wf-reject') {
      this.executeWorkflowAction(action);
      return;
    }
    if (action === 'wf-generate') {
      this.executeGeneratePermit();
      return;
    }
    if (this.workflowMode) {
      this.toastService.show('Under the approval workflow use the workflow buttons on this page.', { class: 'danger' });
      return;
    }
    this.globalStatus = action.toLowerCase();
    const payload: any = {
      ActionType: this.globalStatus,
      AppId: this.selectedOfficeSupplierApplication().AppId.toString(),
      UserId: this.selectedOfficeSupplierApplication().UserId.toString(),
      FinancialYear: this.selectedOfficeSupplierApplication().FinancialYear,
      EALChallanFLs: this.selectedOfficeSupplierApplication().EALChallanFLs || [],
      EALPurchaseOrderFLs: this.selectedOfficeSupplierApplication().EALPurchaseOrderFLs || [],
      ValidityOfPermit: '8 Hours'
    };

    if (this.globalStatus === 'approved') {
      payload.DemandObj = this.selectedOfficeSupplierApplication().DemandDataObject.map((d: any) => ({
        id: d.id, type: d.type, qty: d.qty,
        assignedQuantity: (d.numbering || []).reduce((s: any, n: any) => s + (Number(n.end) - Number(n.start) + 1), 0),
        numbering: (d.numbering || []).map((n: any) => ({ BoxNo: n.BoxNo ?? '', start: String(n.start), end: String(n.end), spoolId: n.spoolId ?? 0 })),
        spoolList: (d.spoolList || []).map((s: any) => ({ BoxId: s.BoxNo ?? s.BoxId ?? '', SpoolId: s.spoolId ?? s.SpoolId ?? 0 }))
      }));

      const totalAssignedQty = payload.DemandObj.reduce((sum: number, d: any) => sum + Number(d.assignedQuantity), 0);
      if (totalAssignedQty < 1000) {
        this.toastService.show('Total assigned configuration volume must be at least 1000 labels minimum.', { class: 'danger' });
        return;
      }
    }
    this.updateApplication(payload);
  }

  updateApplication(payload: any) {
    const finalPayload = {
      ActionType: String(payload.ActionType || "approved"),
      AppId: String(payload.AppId || ""),
      Remark: this.remarks?.trim() || "Approved by Office Terminal",
      UserId: Number(payload.UserId || 0),
      FinancialYear: String(payload.FinancialYear || ""),
      SignerName: String(payload.SignerName || "")
    };

    this.Officeservice.updateOfficeApplication(finalPayload).subscribe({
      next: () => {
        this.toastService.show('Transaction lifecycle updated successfully.', { class: 'success' });
        this.router.navigate(['/officeapplication']);
        this.cancelModalAction(this.globalStatus);
      },
      error: (err) => {
        console.error('API Update Error:', err);
        this.toastService.show(err.error?.message || 'Server API update transaction validation error occurred.', { class: 'danger' });
      }
    });
  }

  onSignAndIssuePermit(): void {
    if (!this.canShowDigitalSign()) {
      this.toastService.show('Digital signing is available only at the final workflow level.', { class: 'danger' });
      return;
    }
    this.openAdobeSignModal();
  }

  openAdobeSignModal(): void {
    if (!this.canShowDigitalSign()) {
      this.toastService.show('Digital signing is available only at the final workflow level.', { class: 'danger' });
      return;
    }
    const now = new Date();
    this.currentSignDate = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${now.toTimeString().split(' ')[0]}`;

    this.availableCertificates = [];
    this.currentSigner = null;
    this.signerName = '';

    this.pdfSignService.getAvailableCertificates().subscribe({
      next: (certs: any[]) => {
        if (certs && certs.length > 0) {
          this.availableCertificates = certs.map(c => ({
            name: c.name || c.Name,
            issuer: c.issuer || c.Issuer,
            validTo: c.validTo || c.ValidTo,
            email: c.email || c.Email,
            fileName: c.fileName || c.FileName,
            serialNumber: c.serialNumber || c.SerialNumber
          }));

          this.selectedCertificateIndex = 0;
          this.currentSigner = this.availableCertificates[0];
          this.signerName = this.currentSigner.name || this.currentSigner.Name;
        } else {
          this.toastService.show('No digital certificates returned from the live API.', { class: 'danger' });
        }

        const modalEl = document.getElementById('adobeSignModal');
        if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Certificate fetch error:', err);
        this.toastService.show('Failed to load certificates from the server.', { class: 'danger' });

        const modalEl = document.getElementById('adobeSignModal');
        if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
        this.cdr.detectChanges();
      }
    });
  }

  onCertificateChange(): void {
    if (this.availableCertificates && this.availableCertificates[this.selectedCertificateIndex]) {
      const selected = this.availableCertificates[this.selectedCertificateIndex];
      this.currentSigner = selected;
      this.signerName = selected.name || selected.Name || '';
      this.cdr.detectChanges();
    }
  }

  closeAdobeSignModal(): void {
    const modalEl = document.getElementById('adobeSignModal');
    if (modalEl) {
      const instance = bootstrap.Modal.getInstance(modalEl);
      if (instance) instance.hide();
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
  }

  executeDigitalSign(): void {
    if (!this.canShowDigitalSign()) {
      this.toastService.show('Digital signing is available only at the final workflow level.', { class: 'danger' });
      return;
    }
    const app = this.selectedOfficeSupplierApplication();
    if (!app || !app.AppId) {
      this.toastService.show('Application data missing!', { class: 'danger' });
      return;
    }

    const selectedSignerName = this.currentSigner?.name || this.currentSigner?.Name || this.signerName;
    const dynamicSerial = this.currentSigner?.serialNumber || this.currentSigner?.SerialNumber || '';

    if (!selectedSignerName || !dynamicSerial) {
      this.toastService.show('Please select a valid live DSC Token certificate!', { class: 'danger' });
      return;
    }

    this.isSigning = true;

    this.pdfSignService.verifyTokenPin(dynamicSerial).subscribe({
      next: () => {
        this.toastService.show('PIN verified via token! Signing permit...', { class: 'info' });

        app.SignerName = selectedSignerName;

        try {
          const docDefinition: any = this.buildFullApplicationDocDefinition(app);
          const pdfDocGenerator = pdfMake.createPdf(docDefinition);

          pdfDocGenerator.getBlob((pdfBlob: Blob) => {
            if (!pdfBlob || pdfBlob.size === 0) {
              this.isSigning = false;
              this.toastService.show('PDF generate error occurred.', { class: 'danger' });
              return;
            }

            const fileName = `Application_${app.EalApplicationNo || app.AppId}.pdf`;
            const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

            const metadata = {
              appId: Number(app.AppId),
              finYear: String(app.FinancialYear || '2026-2027'),
              aplNo: String(app.EalApplicationNo || ''),
              permitNo: String(app.IssuePermitNo || ''),
              district: String(this.displayDistrictName() || ''),
              companyName: String(app.Company_name || ''),
              userId: Number(app.UserId || 0)
            };

            this.pdfSignService.signPdf(pdfFile, selectedSignerName, dynamicSerial, metadata).subscribe({
              next: (signedBlob: Blob) => {
                this.isSigning = false;
                this.closeAdobeSignModal();

                if (this.workflowMode) {
                  // Step 1 done (recorded by the API). Show the signed document and enable Step 2 – Generate Permit.
                  window.open(window.URL.createObjectURL(signedBlob), '_blank');
                  this.toastService.show('Document digitally signed. You can now generate the permit.', { class: 'success' });
                  this.loadWorkflow();
                  return;
                }

                const blobUrl = window.URL.createObjectURL(signedBlob);
                const printWindow = window.open(blobUrl, '_blank');
                if (printWindow) {
                  printWindow.onload = () => {
                    setTimeout(() => {
                      printWindow.focus();
                      printWindow.print();
                    }, 500);
                  };
                }

                this.toastService.show('Permit successfully signed and saved to database!', { class: 'success' });
                setTimeout(() => {
                  this.router.navigate(['/officeapplication']);
                }, 2500);
              },
              error: (err: any) => {
                this.isSigning = false;
                this.toastService.show(err.error?.message || 'Digital signing fail!', { class: 'danger' });
              }
            });
          });
        } catch (e) {
          this.isSigning = false;
          this.toastService.show('PDF generate kora jayni.', { class: 'danger' });
        }
      },
      error: (err: any) => {
        this.isSigning = false;
        this.toastService.show(err.error?.message || 'Hardware token PIN verification cancel incorrect .', { class: 'danger' });
      }
    });
  }

  private buildFullApplicationDocDefinition(data: any): any {
    const formattedDate = this.datePipe.transform(data.CreateDate || new Date(), 'dd-MM-yyyy') || '';
    const permitNumber = data.IssuePermitNo || data.Issue_Permit_No || data.PermitNo
      || (this.workflowMode ? 'Assigned on permit generation' : 'CL/FL/HR/001');

    const poRows: any[] = [
      [
        { text: 'PO Date', bold: true, style: 'tableHeader' },
        { text: 'PO Number', bold: true, style: 'tableHeader' },
        { text: 'Quantity', bold: true, style: 'tableHeader' },
        { text: 'Remaining Qty', bold: true, style: 'tableHeader' },
        { text: 'Valid Upto', bold: true, style: 'tableHeader' },
        { text: 'Status', bold: true, style: 'tableHeader' },
      ]
    ];

    const poSource = (this.filteredPurchaseOrders && this.filteredPurchaseOrders.length > 0)
      ? this.filteredPurchaseOrders
      : (data.filteredPurchaseOrders || data.PurchaseOrders || []);

    if (poSource.length > 0) {
      poSource.forEach((po: any) => {
        poRows.push([
          { text: this.datePipe.transform(po.PODate || po.PurchaseOrderDate || po.CreatedAt, 'dd/MM/yyyy') || '18/09/2025', style: 'smallText' },
          { text: po.PurchaseOrderNo || po.PurchaseOrderNumber || 'PO/2026-2027/004', bold: true, style: 'smallText' },
          { text: Number(po.TotalQty || po.Quantity || 110000).toLocaleString(), style: 'smallText' },
          { text: String(po.RemainingQty ?? '0'), style: 'smallText' },
          { text: this.datePipe.transform(po.ValidUpto || po.CreatedAt, 'dd/MM/yyyy') || '31/03/2027', style: 'smallText' },
          { text: po.Status || 'Selected', style: 'smallText' },
        ]);
      });
    } else {
      poRows.push([
        { text: '18/09/2025', style: 'smallText' },
        { text: 'PO/2026-2027/004', bold: true, style: 'smallText' },
        { text: '1,10,000', style: 'smallText' },
        { text: '0', style: 'smallText' },
        { text: '31/03/2027', style: 'smallText' },
        { text: 'Selected', style: 'smallText' }
      ]);
    }

    const challanRows: any[] = [
      [
        { text: 'Challan Date', bold: true, style: 'tableHeader' },
        { text: 'Challan Number', bold: true, style: 'tableHeader' },
        { text: 'Amount', bold: true, style: 'tableHeader' },
        { text: 'Remaining Amount', bold: true, style: 'tableHeader' },
        { text: 'Status', bold: true, style: 'tableHeader' },
      ]
    ];

    const chSource = (this.filteredChallans && this.filteredChallans.length > 0)
      ? this.filteredChallans
      : (data.filteredChallans || data.Challans || []);

    if (chSource.length > 0) {
      chSource.forEach((ch: any) => {
        challanRows.push([
          { text: this.datePipe.transform(ch.ChallanDate || ch.CreatedAt, 'dd/MM/yyyy') || '07/02/2017', style: 'smallText' },
          { text: ch.ChallanNo || ch.ChallanNumber || 'EX0502170004333', bold: true, style: 'smallText' },
          { text: `Rs. ${Number(ch.ChallanAmount || ch.Amount || 50000).toLocaleString('en-IN')}`, style: 'smallText' },
          { text: `Rs. ${Number(ch.RemainingAmount ?? 22100).toLocaleString('en-IN')}`, style: 'smallText' },
          { text: ch.Status || 'Complete', style: 'smallText' },
        ]);
      });
    }

    const demandRows: any[] = [
      [
        { text: 'Liquor Type', bold: true, style: 'tableHeader' },
        { text: 'Applied Qty', bold: true, style: 'tableHeader' },
        { text: 'Assigned Qty', bold: true, style: 'tableHeader' },
        { text: 'Start No - End No Ranges', bold: true, style: 'tableHeader' },
      ]
    ];

    const demandList = (data.DemandDataObject && data.DemandDataObject.length > 0)
      ? data.DemandDataObject
      : (this.selectedOfficeSupplierApplication()?.DemandDataObject || []);

    if (demandList.length > 0) {
      demandList.forEach((d: any) => {
        demandRows.push([
          { text: d.type || 'FOREIGN LIQUOR', bold: true, style: 'smallText' },
          { text: String(d.qty || 0), style: 'smallText' },
          { text: String(d.assignedQuantity || d.qty || 0), bold: true, style: 'smallText' },
          { text: d.rangeDisplay_text || '-', bold: true, style: 'smallText', color: '#198754' },
        ]);
      });
    }

    return {
      pageSize: 'A4',
      pageMargins: [20, 15, 20, 15],
      content: [
        { text: 'CHHATTISGARH STATE EXCISE DEPARTMENT', style: 'mainHeader', alignment: 'center' },
        { text: 'Excise Adhesive Labels Application & Verification Summary', style: 'subHeader', alignment: 'center', margin: [0, 2, 0, 6] },

        {
          table: {
            widths: ['33%', '34%', '33%'],
            body: [
              [
                { text: `Application No: ${data.EalApplicationNo || 'EAL/2026-2027/004'}`, bold: true, fontSize: 9 },
                { text: `Permit No: ${permitNumber}`, bold: true, fontSize: 9, alignment: 'center', color: '#d9534f' },
                { text: `Date: ${formattedDate}`, bold: true, fontSize: 9, alignment: 'right' }
              ]
            ]
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#b6d4fe',
            vLineColor: () => '#b6d4fe',
            fillColor: () => '#f8fafd'
          },
          margin: [0, 0, 0, 6]
        },

        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    { text: 'Company Details', style: 'boxTitle' },
                    {
                      table: {
                        widths: ['22%', '2%', '76%'],
                        body: [
                          [{ text: 'Name', bold: true, style: 'smallText' }, { text: ':' }, { text: `${data.Company_name || 'WELCOME DISTT. PVT. LTD.'}`, style: 'smallText' }],
                          [{ text: 'Address', bold: true, style: 'smallText' }, { text: ':' }, { text: `${data.Address || '-'}`, style: 'smallText' }],
                          [{ text: 'District / State', bold: true, style: 'smallText' }, { text: ':' }, { text: `${this.displayDistrictName()} | ${data.State || 'Chhattisgarh'}`, style: 'smallText' }],
                          [{ text: 'Pin / Transport / Route', bold: true, style: 'smallText' }, { text: ':' }, { text: `${data.Pin || '492001'} | Transport: ${data.ModeOfTransport || 'By Road'} | Route: ${data.Route || 'National Higway'}`, style: 'smallText' }]
                        ]
                      },
                      layout: 'noBorders',
                      margin: [0, 2, 0, 0]
                    }
                  ]
                }
              ]
            ]
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#dee2e6',
            vLineColor: () => '#dee2e6',
            fillColor: () => '#ffffff'
          },
          margin: [0, 0, 0, 5]
        },

        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    { text: 'Authorised Person', style: 'boxTitle' },
                    {
                      table: {
                        widths: ['22%', '2%', '76%'],
                        body: [
                          [{ text: 'Name', bold: true, style: 'smallText' }, { text: ':' }, { text: `${data.AuthPersonName || 'WELCOME DISTT. PVT. LTD.'}`, style: 'smallText' }],
                          [{ text: 'Phone', bold: true, style: 'smallText' }, { text: ':' }, { text: `${data.AuthPersonPhone || '9617775419'}`, style: 'smallText' }],
                          [{ text: 'Address', bold: true, style: 'smallText' }, { text: ':' }, { text: `${data.AuthPersonAdd || 'Naya Raipur'}`, style: 'smallText' }]
                        ]
                      },
                      layout: 'noBorders',
                      margin: [0, 2, 0, 0]
                    }
                  ]
                }
              ]
            ]
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#dee2e6',
            vLineColor: () => '#dee2e6',
            fillColor: () => '#ffffff'
          },
          margin: [0, 0, 0, 6]
        },

        { text: 'Purchase Orders', style: 'sectionHeader' },
        {
          table: {
            widths: ['15%', '27%', '15%', '15%', '15%', '13%'],
            body: poRows
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#ced4da',
            vLineColor: () => '#ced4da'
          },
          margin: [0, 0, 0, 6]
        },

        { text: 'Challan Details', style: 'sectionHeader' },
        {
          table: {
            widths: ['18%', '28%', '20%', '20%', '14%'],
            body: challanRows
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#ced4da',
            vLineColor: () => '#ced4da'
          },
          margin: [0, 0, 0, 6]
        },

        { text: 'Demand Details & Mapped Ranges', style: 'sectionHeader' },
        {
          table: {
            widths: ['35%', '15%', '15%', '35%'],
            body: demandRows
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#ced4da',
            vLineColor: () => '#ced4da'
          },
          margin: [0, 0, 0, 6]
        },

        { text: 'Remarks', style: 'sectionHeader' },
        {
          table: {
            widths: ['*'],
            body: [
              [
                { text: data.AdminRemarks || data.Remarks || 'Digitally Verified and Approved.', style: 'smallText', margin: [4, 3, 4, 3] }
              ]
            ]
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#ced4da',
            vLineColor: () => '#ced4da',
            fillColor: () => '#fafafa'
          },
          margin: [0, 0, 0, 8]
        },

        {
          columns: [
            { text: '', width: '*' },
            {
              stack: [
                { text: 'Authorised Signatory', bold: true, fontSize: 9.5 },
                { text: 'Office of The Excise Commissioner', bold: true, fontSize: 8.5 },
                { text: 'Chhattisgarh, Sector 19, Nava Raipur', bold: true, fontSize: 8.5 }
              ],
              alignment: 'right'
            }
          ],
          margin: [0, 4, 0, 0]
        }
      ],

      styles: {
        mainHeader: { fontSize: 12, bold: true },
        subHeader: { fontSize: 8.5, bold: true, color: '#333' },
        boxTitle: { fontSize: 8.5, bold: true, color: '#0d6efd', margin: [0, 0, 0, 1] },
        sectionHeader: { fontSize: 8.5, bold: true, color: '#0d6efd', margin: [0, 2, 0, 2] },
        tableHeader: { fontSize: 7.5, bold: true, fillColor: '#cfe2ff', alignment: 'center' },
        smallText: { fontSize: 7.5 }
      },
    };
  }

  createDocumentFormGroup(doc: any): FormGroup { return this.fb.group({}); }
  test() { }
}