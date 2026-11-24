import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OfficeService } from '../services/office.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../services/toast.service';
import { StockService } from '../services/stock.service';

@Component({
    selector: 'app-hb-application-detail',
    standalone: true,
    imports: [SidebarComponent, CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './hb-application-detail.component.html',
    styleUrl: './hb-application-detail.component.css'
})
export class HBApplicationDetailComponent {

  officeAppId!: number;
  selectedOfficeSupplierApplication = this.Officeservice.selectedOfficeSupplierApplication;
  modeType: string = 'view';

  actions = [
    // { label: 'Need Clarification', value: 'need_clarification', status: 2, class: 'btn-warning', show: false },
    { label: 'Approve', value: 'approved', status: 5, class: 'btn-success', show: false },
    { label: 'Reject', value: 'rejected', status: 4, class: 'btn-danger', show: false },
    { label: 'Generate Permit', value: 'completed', status: 6, class: 'btn-dark', show: false },
  ];
  trackByBox(index: number, box: any): string {
    return box.BoxNo;
  }

  trackByEntry(index: number, entry: any): string {
    return entry.StartNo;
  }

  showConfirmation: boolean = false;
  selectedAction: any = null;

  // documentsForm!: FormGroup;
  documentsList: any[] = [];
  globalStatus: string = '';

  isAssignConfirmation: boolean = false;

  constructor(private fb: FormBuilder, private Officeservice: OfficeService, private route: ActivatedRoute, private router: Router, private toastService: ToastService, private stockService: StockService, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.officeAppId = Number(this.route.snapshot.paramMap.get('id'));
    // console.log('Office Application ID:', this.officeAppId, this.selectedOfficeSupplierApplication());
    if (!this.officeAppId || !this.selectedOfficeSupplierApplication()) {
      this.router.navigate(['/barapplication']);
    }

    // this.loadDocuments();
    const demandData = this.selectedOfficeSupplierApplication()?.DemandDataObject;
    if (demandData && demandData.length > 0) {
      // this.selectedLiquorType = demandData[0].id;
      this.selectedOfficeSupplierApplication().DemandDataObject.forEach(demand => {
        demand['assignedQuantity'] = 0;
        demand['numbering'] = [];
      });
    }

    this.updateActions();
  }
  isEmptyObject(obj: any): boolean {
    return obj && Object.keys(obj).length === 0;
  }

  downloadFile(fileData: string, fileName: string) {
    const byteCharacters = atob(fileData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const fileBlob = new Blob([byteArray], { type: 'application/pdf' });
    const fileURL = URL.createObjectURL(fileBlob);
    window.open(fileURL, '_blank');

  }
  goBack(): void {
    this.router.navigate(['/barapplication']);
  }
  printApplication() {
    window.print();
  }
  filteredActions() {
    return this.actions.filter(action => action.show);
  }

  getModalTitle(status: string): string {
    switch (status) {
      case 'approved': return 'Approve Application';
      case 'rejected': return 'Reject Application';
      case 'need_clarification': return 'Request Clarification';
      case 'completed': return 'Complete Application';
      default: return 'Confirmation';
    }
  }

  getModalMessage(status: string): string {
    switch (status) {
      case 'approved': return 'Are you sure you want to approve this application?';
      case 'rejected': return 'Are you sure you want to reject this application?';
      case 'need_clarification': return 'Are you sure you want to request clarification for this application?';
      case 'completed': return 'Are you sure you want to mark this application as completed?';
      default: return 'Are you sure you want to proceed?';
    }
  }

  updateActions() {
    if (this.selectedOfficeSupplierApplication().StatusName['Status_Id'] === 1 || this.selectedOfficeSupplierApplication().StatusName['Status_Id'] === 3) {
      this.actions.forEach(action => {
        if ([5, 4, 2].includes(action.status)) { // Show only Approve, Reject, Need Clarification
          action.show = true;
        } else {
          action.show = false;
        }
      });
    } else if (this.selectedOfficeSupplierApplication().StatusName['Status_Id'] === 5) {
      this.actions.forEach(action => {
        action.show = action.status === 6; // Show only Generate Permit for Status_Id 6
      });
    }
    else {
      this.actions.forEach(action => action.show = false); // Hide all if no matching status (Completed & Rejected)
    }
  }



  async onActionClick(action: any) {
    // console.log('Button clicked:', action.value);
    this.globalStatus = action.value;

    const modalId = `#${this.globalStatus}`;

    // Ensure modal is detached and re-attached to force jQuery recognition
    $(modalId).removeClass('fade').modal('hide'); // Reset state
    setTimeout(() => {
      $(modalId).addClass('fade').modal('show');
    }, 100);
  }
// hb-application-detail.component.ts

async confirmModalAction(action: string) {
  this.globalStatus = action.toLowerCase();
  const appData = this.selectedOfficeSupplierApplication();

  // Determine the source of demand data based on the current application status
  const sourceData = (appData.Status == '5' || appData.Status == '6') 
                     ? appData.DemandDataObjectViewMode 
                     : appData.DemandDataObject;

  const payload: any = {
    ActionType: this.globalStatus,
    AppId: String(appData.AppId), // Backend expects string
    UserId: Number(appData.UserId), // Backend expects int
    FinancialYear: appData.FinancialYear,
    Remark: "Processed",
    ValidityOfPermit: "8 Hours",
    
    // Ensure these arrays are NOT null, as the backend loops through them
    EALChallanFLs: appData.EALChallanFLs || [],
    EALPurchaseOrderFLs: appData.EALPurchaseOrderFLs || [],
    
    // Map the DemandObj to satisfy backend DTO and logic
    DemandObj: (sourceData || []).map((d: any) => ({
      type: String(d.type),
      qty: String(d.qty),
      id: String(d.id),
      detailId: d.detailId && d.detailId !== 'undefined' ? String(d.detailId) : "0",
      assignedQuantity: Number(d.assignedQuantity || 0),
      
      // Map numbering for permit generation visibility
      numbering: (d.numbering || []).map((n: any) => ({
        EalTypeId: Number(n.ealTypeId || n.EalTypeId || 0),
        BoxId: String(n.boxId || n.BoxId || n.BoxNo || ""),
        SpoolId: Number(n.spoolId || n.SpoolId || 0),
        Start: String(n.start || n.Start || n.SpoolStartFrom || ""),
        End: String(n.end || n.End || n.SpoolEnd || "")
      })),

      spoolList: (d.spoolList || []).map((s: any) => ({
        BoxId: String(s.boxId || s.BoxId || s.BoxNo || ""),
        SpoolId: Number(s.spoolId || s.SpoolId || 0)
      }))
    }))
  };

  await this.updateApplication(payload);
}

updateApplication(payload: any) {
  this.Officeservice.updateOfficeApplication(payload).subscribe({
    next: (response) => {
      this.toastService.show('Application Updated successfully!', { class: 'success' });
      
      // Programmatically hide the modal using jQuery to prevent focus trap errors
      $(`#${this.globalStatus}`).modal('hide');
      $('.modal-backdrop').remove(); // Clean up backdrop
      
      this.router.navigate(['/barapplication']);
    },
    error: (error) => {
      console.error('HB API Error:', error);
      this.toastService.show('Validation Error: Check Network Tab', { class: 'danger' });
      $(`#${this.globalStatus}`).modal('hide');
    }
  });
}

  cancelModalAction(action: string) {
    $(`#${action}`).modal('hide');
  }


  async confirmReject() {
    // console.log('Application Rejected');
    $('#rejectConfirmationModal').modal('hide');
    let payload = {
      "ActionType": "rejected",
      "AppId": this.selectedOfficeSupplierApplication().AppId.toString(),
      // "Remark": this.documentsForm.value.adminRemarks,
      "UserId": this.selectedOfficeSupplierApplication().UserId,
      // "Documents": this.documentsForm.value.documents
    }
    await this.updateApplication(payload);
  }

  cancelReject() {
    $('#rejectConfirmationModal').modal('hide');
  }

  createDocumentFormGroup(doc: any): FormGroup {
    return this.fb.group({
      AppId: new FormControl(doc.AppId),
      DocTypeId: new FormControl(doc.DocTypeId),
      UserId: new FormControl(doc.UserId),
      docTypeName: new FormControl(doc.DocTypeName),
      fileName: new FormControl(doc.FileName),
      fileData: new FormControl(doc.FileData),
      verificationStatus: new FormControl('', Validators.required)
    });
  }

  selectedStock: any[] = [];

  openAssignModal(type: string) {
    // let modal = new bootstrap.Modal(document.getElementById('assignModal')!);
    // modal.show();
    $('#assignModal').modal('show');
    if (type == 'edit') {
      this.getStockQuantityForAssignment();
    } else {
      this.getLabelAssignmentDetails();
    }
  }

  toggleBoxSelection(box) {
    // console.log('boxSelection', box);

    let demandObj = this.selectedOfficeSupplierApplication().DemandDataObject
    let liquorTypeIndex = demandObj.findIndex(item => item.id == box.ealTypeId);

    if (box.selected) {
      let totalSpoolQty = box.Entries.reduce((sum, entry) => sum + entry.total, 0);

      if (liquorTypeIndex > -1) {
        let remainingQty = parseInt(demandObj[liquorTypeIndex]['qty']) - demandObj[liquorTypeIndex]['assignedQuantity'];
        if (totalSpoolQty > remainingQty) {
          setTimeout(() => {
            box.selected = false;
            this.cdr.detectChanges();
          });
          this.toastService.show('You cannot select more than the applied quantity.', { class: 'danger' });
          return;
        }
      }

      // Reset assignedQuantity for accuracy
      demandObj[liquorTypeIndex]['assignedQuantity'] = demandObj[liquorTypeIndex]['assignedQuantity'] - box.Entries.reduce((sum, entry) => entry.selected ? sum + entry.total : sum, 0) + totalSpoolQty;
      box.Entries.forEach(entry => entry.selected = true);
    }
    else {
      // Deselect all spools
      if (!box.selected) {
        let selectedSpoolQty = box.Entries.reduce((sum, entry) => entry.selected ? sum + entry.total : sum, 0);
        demandObj[liquorTypeIndex]['assignedQuantity'] -= selectedSpoolQty;
        box.Entries.forEach(entry => entry.selected = false);
      }
    }

    // console.log('this.filteredStockData:', this.filte redStockData);

    setTimeout(() => this.cdr.detectChanges(), 0);
    this.processSelectedSpools();
  }

  updateSelection(box: any, entry: any) {
    const demandObj = this.selectedOfficeSupplierApplication().DemandDataObject;
    const liquorTypeIndex = demandObj.findIndex(item => item.id == box.ealTypeId);

    if (entry.selected) {
      // Get all selected entries in order
      const selectedEntries = box.Entries
        .filter(e => e.selected)
        .sort((a, b) => Number(a.StartNo) - Number(b.StartNo));

      // If there is already a selected spool, enforce sequence
      if (selectedEntries.length > 1) {
        const prev = selectedEntries[selectedEntries.length - 2];
        const current = selectedEntries[selectedEntries.length - 1];

        if (Number(current.StartNo) !== Number(prev.EndNo) + 1) {
          this.toastService.show('You must select spools in sequence.', { class: 'danger' });
          setTimeout(() => {
            entry.selected = false;
            this.cdr.detectChanges();
          });
          return;
        }
      }

      // Quantity check
      const remainingQty = demandObj[liquorTypeIndex]['qty'] - demandObj[liquorTypeIndex]['assignedQuantity'];
      if (entry.total > remainingQty) {
        this.toastService.show('You cannot select more than the applied quantity.', { class: 'danger' });
        setTimeout(() => {
          entry.selected = false;
          this.cdr.detectChanges();
        });
        return;
      }
      demandObj[liquorTypeIndex]['assignedQuantity'] += entry.total;
    } else {
      // Deselect reduces assigned quantity
      demandObj[liquorTypeIndex]['assignedQuantity'] =
        Math.max(0, demandObj[liquorTypeIndex]['assignedQuantity'] - entry.total);

      // If you want to enforce sequence strictly, deselecting one spool should clear all later ones:
      box.Entries.forEach(e => {
        if (Number(e.StartNo) > Number(entry.StartNo)) {
          e.selected = false;
        }
      });
    }

    // Auto-select box if all spools are checked
    box.selected = box.Entries.every(e => e.selected);

    setTimeout(() => this.cdr.detectChanges(), 0);
    this.processSelectedSpools();
  }



  labelAssignment(type: string) {
    // console.log('Assigned Stock:', this.selectedStock);
    // alert('Labels Assigned Successfully!');
    // $('#assignModal').modal('hide');

    if (type == 'confirmAssign') {
      // console.log('Assign', this.tempDemandObj);
      this.isAssignConfirmation = true;
    } else {
      this.isAssignConfirmation = false;
      // this.selectedOfficeSupplierApplication().DemandDataObject = [...this.tempDemandObj];
      this.selectedOfficeSupplierApplication().DemandDataObject = this.tempDemandObj.map(demand => ({
        ...demand,
        numbering: [...demand.numbering]
      }));
    }
    $('#assignModal').modal('hide');
  }


  filters = {
    // financialYear: '2024-2025',
    financialYear: null,
    month: null,
    ealTypeId: null,
    stockStatus: 'In Stock',
    boxId: null,
  };
  stockData: any[] = [];
  tempDemandObj: any[] = [];

  getStockQuantityForAssignment() {

    const currentDate = new Date();
    let year = currentDate.getFullYear();

    // If the current month is before April, it belongs to the previous financial year
    if (currentDate.getMonth() < 3) {
      year--; // Decrease the year if the current date is before April
    }

    this.filters.financialYear = `${year}-${year + 1}`; // Format the financial year


    if (!this.isAssignConfirmation) {
      const payload = Object.fromEntries(
        Object.entries(this.filters).filter(([_, value]) => value != null)
      );

      this.stockService.getStockQuantityForAssignment(payload).subscribe({
        next: (response: any) => {
          this.stockData = response.Data;
          this.stockData.forEach(box => {
            box.ealTypeId = box.Entries[0].ealTypeId;
            if (box.selected === undefined) box.selected = false;
            box.Entries.forEach(entry => {
              if (entry.selected === undefined) entry.selected = false;
            });
          });
          this.tempDemandObj = JSON.parse(JSON.stringify(this.selectedOfficeSupplierApplication().DemandDataObject));
          // console.log('this.tempDemandObj:', this.tempDemandObj);

        },
        error: (error) => {
          let errorMessage = 'Something went Wrong!';
          this.toastService.show(errorMessage, { class: 'danger' });
        },
      });
    }
  }

  getLabelAssignmentDetails() {
    let payload = {
      "AppId": this.selectedOfficeSupplierApplication().AppId
    }
    // console.log('Payload:', payload);

    this.Officeservice.getLabelAssignmentDetailsAPI(payload).subscribe({
      next: (response: any) => {
        // console.log('RRRRREEEEESSSSPPPPPOOOOONNNNSSSSSSSEEEEE', response);

        const transformedResponse = Object.values(
          response.reduce((acc, item) => {
            const ealTypeId = item.EALType;

            if (!acc[ealTypeId]) {
              acc[ealTypeId] = {
                ealTypeId,
                Numbering: []
              };
            }


            acc[ealTypeId].Numbering.push({
              ealTypeId,
              BoxId: item.BoxNo,
              SpoolId: item.SpoolId,
              BoxNo: item.BoxNo,
              AppId: item.AppId,
              SpoolStartFrom: item.SpoolStartFrom,
              SpoolEnd: item.SpoolEnd
            });

            return acc;
          }, {})
        );

        // console.log(transformedResponse);
        this.processSelectedSpoolsViewModeNumbering(transformedResponse);
      },
      error: (error) => {
        let errorMessage = 'Something went Wrong!';
        this.toastService.show(errorMessage, { class: 'danger' });
      },
    });
  }

  selectedLiquorType: string = '';

  get filteredStockData() {
    // console.log('this.stockData:', this.stockData, this.selectedLiquorType);
    return this.stockData.filter(box => box.ealTypeId == this.selectedLiquorType);
  }

  get hasMatchingStock(): boolean {
    return this.filteredStockData.length > 0;
  }


  selectedSpools: any[] = []; // Holds selected spools
  groupedSpools: { start: string; end: string }[] = []; // Holds merged ranges

  processSelectedSpools() {
    let selected = this.stockData
      .flatMap(spool => spool.Entries)
      .filter(entry => entry.selected);

    selected.sort((a, b) => Number(a.StartNo) - Number(b.StartNo));

    let mergedRanges = [];
    let currentRange = null;

    for (let spool of selected) {
      if (!currentRange) {
        currentRange = { ealTypeId: spool.ealTypeId, boxId: spool.boxId, spoolId: spool.spoolId, start: spool.StartNo, end: spool.EndNo };
      } else {
        // If the next spool starts immediately after the previous one, merge
        if (Number(spool.StartNo) === Number(currentRange.end) + 1) {
          currentRange.end = spool.EndNo;
        } else {
          mergedRanges.push(currentRange);
          currentRange = { ealTypeId: spool.ealTypeId, boxId: spool.boxId, spoolId: spool.spoolId, start: spool.StartNo, end: spool.EndNo };
        }
      }
    }
    if (currentRange) {
      mergedRanges.push(currentRange);
    }

    let demandObj = this.selectedOfficeSupplierApplication()?.DemandDataObject;
    if (mergedRanges.length > 0 && demandObj) {
      this.selectedOfficeSupplierApplication().DemandDataObject = demandObj.map(demand => ({
        ...demand,
        numbering: mergedRanges.filter(spool => spool.ealTypeId == demand.id),
        spoolList: selected.filter(actions => actions.selected && actions.ealTypeId == demand.id)
      }));
    }
  }


  processSelectedSpoolsViewModeNumbering(data) {
    let selected = data
      .flatMap(spool => spool.Numbering)

    selected.sort((a, b) => Number(a.SpoolStartFrom) - Number(b.SpoolStartFrom));
    let mergedRanges = [];
    let currentRange = null;

    for (let spool of selected) {
      if (!currentRange) {
        currentRange = { ealTypeId: spool.ealTypeId, BoxNo: spool.BoxNo, spoolId: spool.SpoolId, start: spool.SpoolStartFrom, end: spool.SpoolEnd };
      } else {
        // If the next spool starts immediately after the previous one, merge
        if (Number(spool.SpoolStartFrom) === Number(currentRange.end) + 1) {
          currentRange.end = spool.SpoolEnd;
        } else {
          mergedRanges.push(currentRange);
          currentRange = { ealTypeId: spool.ealTypeId, BoxNo: spool.BoxNo, spoolId: spool.SpoolId, start: spool.SpoolStartFrom, end: spool.SpoolEnd };
        }
      }
    }
    if (currentRange) {
      mergedRanges.push(currentRange);
    }

    let demandObj = this.selectedOfficeSupplierApplication()?.DemandDataObjectViewMode;
    this.selectedOfficeSupplierApplication().DemandDataObjectViewMode = demandObj.map(demand => ({
      ...demand,
      numbering: mergedRanges.filter(spool => spool.ealTypeId == demand.id)
    }));
  }

  test() {
    console.log('test', this.selectedOfficeSupplierApplication());
  }
}
