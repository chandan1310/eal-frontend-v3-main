import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OfficeService } from '../services/office.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { StockService } from '../services/stock.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-office-application-detail',
  standalone: true,
  imports: [SidebarComponent, CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './office-application-detail.component.html',
  styleUrl: './office-application-detail.component.css'
})
export class OfficeApplicationDetailComponent {
  officeAppId!: number;
  selectedOfficeSupplierApplication = this.Officeservice.selectedOfficeSupplierApplication;
  modeType: string = 'view';

  actions = [
    { label: 'Approve', value: 'approved', status: 5, class: 'btn-success', show: false },
    { label: 'Reject', value: 'rejected', status: 4, class: 'btn-danger', show: false },
    { label: 'Generate Permit', value: 'completed', status: 6, class: 'btn-dark', show: false },
  ];

  showConfirmation: boolean = false;
  selectedAction: any = null;

  globalStatus: string = '';

  isAssignConfirmation: boolean = false;
  validityOfPermit: string = '';
  location: any;

  constructor(private fb: FormBuilder, private Officeservice: OfficeService, private route: ActivatedRoute, private router: Router, private toastService: ToastService, private stockService: StockService, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.officeAppId = Number(this.route.snapshot.paramMap.get('id'));
    // console.log('Office Application ID:', this.officeAppId, this.selectedOfficeSupplierApplication());
    if (!this.officeAppId || !this.selectedOfficeSupplierApplication()) {
      this.router.navigate(['/officeapplication']);
    }

    // this.loadDocuments();
    const demandData = this.selectedOfficeSupplierApplication()?.DemandDataObject;
    if (demandData && demandData.length > 0) {
      this.selectedOfficeSupplierApplication().DemandDataObject.forEach(demand => {
        demand['assignedQuantity'] = 0;
        demand['numbering'] = [];
      });
    }
    this.selectedOfficeSupplierApplication()["EALPurchaseOrderFLs"].forEach((item) => {
      const matchingAppPO = this.selectedOfficeSupplierApplication().Application_POs.find(appPO => this.selectedOfficeSupplierApplication().AppId == appPO.AppId && appPO.PurchaseOrderNo == item.PurchaseOrderNo);
      if (matchingAppPO) {
        item["assignedQty"] = matchingAppPO.used_qty;
      }
    })

    this.selectedOfficeSupplierApplication()["EALChallanFLs"].forEach((item) => {
      const matchingAppPO = this.selectedOfficeSupplierApplication().Application_Challans.find(appPO => this.selectedOfficeSupplierApplication().AppId == appPO.AppId && appPO.ChallanNo == item.ChallanNo);
      if (matchingAppPO) {
        item["assignedAmount"] = matchingAppPO.Used_Amount;
      }
    })

    this.updateActions();
  }

  isEmptyObject(obj: any): boolean {
    return obj && Object.keys(obj).length === 0;
  }

  downloadFile(fileData: string, fileName: string) {
    // Convert Base64 to Blob
    const byteCharacters = atob(fileData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const fileBlob = new Blob([byteArray], { type: 'application/pdf' });

    // Create URL for the Blob
    const fileURL = URL.createObjectURL(fileBlob);

    // Open in New Tab (for preview)
    window.open(fileURL, '_blank');
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

  goBack(): void {
    this.router.navigate(['/officeapplication']);
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

  async confirmModalAction(action: string) {
    // console.log('Confirm button clicked:', action);

    const payload = {
      ActionType: this.globalStatus == 'rejected' ? 'rejected' : action,
      AppId: this.selectedOfficeSupplierApplication().AppId.toString(),
      // Remark: this.documentsForm.value.adminRemarks,
      UserId: this.selectedOfficeSupplierApplication().UserId,
    };

    const validActions = ['rejected', 'approved', 'completed'];

    if (validActions.includes(payload.ActionType)) {
      if (payload.ActionType == 'approved') {
        payload["DemandObj"] = [...this.selectedOfficeSupplierApplication().DemandDataObject];
      }
      payload["FinancialYear"] = this.selectedOfficeSupplierApplication().FinancialYear;
      payload["EALChallanFLs"] = this.selectedOfficeSupplierApplication().EALChallanFLs;
      payload["EALPurchaseOrderFLs"] = this.selectedOfficeSupplierApplication().EALPurchaseOrderFLs;
      await this.updateApplication(payload);
    } else {
      // console.warn('Invalid action:', action);
    }
  }


  cancelModalAction(action: string) {
    $(`#${action}`).modal('hide');
  }


  updateApplication(payload: any) {
    // console.log('test', this.selectedOfficeSupplierApplication());
    // console.log('Application Updated:', payload);
    payload["ValidityOfPermit"] = this.validityOfPermit;
    this.Officeservice.updateOfficeApplication(payload).subscribe(
      (response) => {
        // console.log('Application Updated successfully:', response);
        this.toastService.show('Application Updated successfully!', {
          class: 'success',
        });
        this.router.navigate(['/officeapplication']);
        setTimeout(() => {
          window.location.reload();
        }, 500);
        $(`#${this.globalStatus}`).modal('hide');
      },
      (error) => {
        // console.error('Error submitting form:', error);
        this.toastService.show('Something Went Wrong', { class: 'danger' });
        $(`#${this.globalStatus}`).modal('hide');
      }
    );
  }

  async confirmReject() {
    // console.log('Application Rejected');
    $('#rejectConfirmationModal').modal('hide');
    let payload = {
      "ActionType": "rejected",
      "AppId": this.selectedOfficeSupplierApplication().AppId.toString(),
      // "Remark": this.documentsForm.value.adminRemarks,
      "UserId": this.selectedOfficeSupplierApplication().UserId,
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

    // console.log('this.filteredStockData:', this.filteredStockData);

    setTimeout(() => this.cdr.detectChanges(), 0);
    this.processSelectedSpools();
  }

  updateSelection(box, entry) {
    let demandObj = this.selectedOfficeSupplierApplication().DemandDataObject;
    let liquorTypeIndex = demandObj.findIndex(item => item.id == box.ealTypeId);

    if (entry.selected) {
      let remainingQty = demandObj[liquorTypeIndex]['qty'] - demandObj[liquorTypeIndex]['assignedQuantity'];
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
      demandObj[liquorTypeIndex]['assignedQuantity'] = Math.max(0, demandObj[liquorTypeIndex]['assignedQuantity'] - entry.total);
    }

    // Only auto-select box if all spools are checked
    box.selected = box.Entries.every(e => e.selected);
    setTimeout(() => this.cdr.detectChanges(), 0);
    this.processSelectedSpools();
  }


  labelAssignment(type: string) {
    // console.log('Assigned Stock:', this.selectedStock);
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
          // this.tempDemandObj = [...this.selectedOfficeSupplierApplication().DemandDataObject];
          // console.log('this.tempDemandObj:', this.tempDemandObj);
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
  printApplication() {
    window.print();
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
    // console.log('selected:', selected);


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
    // console.log('data:', data);
    let selected = data
      .flatMap(spool => spool.Numbering)

    selected.sort((a, b) => Number(a.SpoolStartFrom) - Number(b.SpoolStartFrom));
    // console.log('selected:', selected);

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
    // console.log('test', this.selectedOfficeSupplierApplication());
  }
}
