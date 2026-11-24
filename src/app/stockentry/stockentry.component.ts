import { Component, OnInit } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';

import { FormArray, FormBuilder, FormGroup, FormsModule, Validators } from '@angular/forms';
import { StockService } from '../services/stock.service';
import { ToastService } from '../services/toast.service';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { validateHeaderValue } from 'node:http';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { DispatchEntryComponent } from '../dispatch-entry/dispatch-entry.component';

@Component({
    selector: 'app-stockentry',
    standalone: true,
    imports: [SidebarComponent, FormsModule, DispatchEntryComponent],
    templateUrl: './stockentry.component.html',
    styleUrl: './stockentry.component.css'
})
export class StockentryComponent implements OnInit {
  rows!: any[];
  currentFinancialYear: string = ''; // Variable to store the current financial year
  allMonths: any[] = [];
  ealTypes: any[] = [];
  selectedEalType: string | null = null;
  selectedMonth: any | null = null;
  maxDate: string = '';
  minDate!: string;
  placeFromList: any[] = [];
  globalStatus: string = '';
  stockform: FormGroup;
  dcNo: string = '';
  dcExists: boolean = false;
  lastBoxNo: string = '';
  lastFromNo: string = '';
  lastToNo: string = ''
  enteredBoxQty: number | string = '';
  startBoxNo: string = '';
  endBoxNo: string = '';
  lastSpoolEnd: string = '';
  startSpoolNo: string = '';
  endSpoolNo: string = '';
  searchDate: string;
  packSizes: any[] = [];
  private searchTimeout: any;

  /** Approved indents with boxes still to dispatch; a new DC must belong to one of them. */
  openIndents: any[] = [];
  selectedIndentNo: string = '';




  constructor(private fb: FormBuilder,
    private stockService: StockService,
    private toastService: ToastService,
    private http: HttpClient,
    private route: ActivatedRoute
  ) { }

  loadOpenIndents(): void {
    this.stockService.indentsOpenForDispatch().subscribe({
      next: (list) => {
        this.openIndents = Array.isArray(list) ? list : [];
        const wanted = this.route.snapshot.queryParamMap.get('indent');
        if (wanted && this.openIndents.some(i => i.IndentNo === wanted)) this.selectedIndentNo = wanted;
      },
      error: () => this.openIndents = []
    });
  }

  get selectedIndent(): any {
    return this.openIndents.find(i => i.IndentNo === this.selectedIndentNo) || null;
  }

  /** EAL types the selected indent still needs (empty = no indent chosen → all types). */
  get indentEalTypeIds(): number[] {
    const ind = this.selectedIndent;
    return ind ? ind.Items.filter((x: any) => x.BalanceBoxes > 0).map((x: any) => Number(x.EALTypeId)) : [];
  }

  ngOnInit(): void {
    // Load external JS
    const node = document.createElement('script');
    node.src = 'assets/js/stockEntry.js';
    node.type = 'text/javascript';
    node.async = true;
    node.charset = 'utf-8';
    document.getElementsByTagName('head')[0].appendChild(node);

    // Load supporting data
    this.getCurrentFinancialYear();
    this.loadEalTypes();
    this.loadPlaceFrom();
    this.loadPackSizes();
    this.loadOpenIndents();

    // Set current month and date
    const currentMonth = new Date().getMonth() + 1;
    this.selectedMonth = currentMonth;
    this.maxDate = new Date().toISOString().split('T')[0];

    // Initialize form
    this.stockForm = this.fb.group({
      financialYear: [{ value: this.currentFinancialYear, disabled: true }, Validators.required],
      entryDate: [this.maxDate, Validators.required],
      dcNo: ['', Validators.required],
      fromPlace: ['', Validators.required],
      stockItems: this.fb.array([])
    });

    // Optional: preload last box number with quantity 1
    this.stockService.getBoxDetails(1).subscribe({
      next: (data) => {
        this.lastBoxNo = data.lastBoxNo.toString();
      },
      error: (err) => {
        console.error('❌ Error fetching last Box Number:', err);
      }
    });
  }

  // Pack Size Open //
  loadPackSizes() {
    this.stockService.getPackSizes().subscribe({
      next: (data) => {
        this.packSizes = data;
        this.setDefaultPackSizes();
      },
      error: (err) => {
        console.error('Error loading pack sizes:', err);
      }
    });
  }
  setDefaultPackSizes() {
    const items = this.stockForm.get('stockItems') as FormArray;

    items.controls.forEach(ctrl => {
      ctrl.get('selectedPackSize')?.setValue('ALL');
      ctrl.get('allPackSizes')?.setValue(this.packSizes.map(p => p.packsizeId));
    });
  }


  onPackSizeChange(selectedValue: any, index: number) {
    if (selectedValue === "ALL") {
      this.stockItems[index].allPackSizes = this.packSizes.map(p => p.packsizeId);
    } else {
      this.stockItems[index].selectedPackSize = selectedValue;
    }
  }
  // Pack Size Close //


  getCurrentFinancialYear(): void {
    const currentDate = new Date();
    let year = currentDate.getFullYear();

    // If the current month is before April, it belongs to the previous financial year
    if (currentDate.getMonth() < 3) {
      year--; // Decrease the year if the current date is before April
    }

    this.currentFinancialYear = `${year}-${year + 1}`; // Format the financial year

    // setFinancialYearLimits
    const today = new Date();
    let startYear: number;
    let endYear: number;
    if (today.getMonth() + 1 >= 4) {
      // If month is April (4) or later, financial year is the current year
      startYear = today.getFullYear();
      endYear = today.getFullYear() + 1;
    } else {
      // If month is Jan, Feb, or March, financial year started last year
      startYear = today.getFullYear() - 1;
      endYear = today.getFullYear();
    }

    const min = new Date(startYear, 3, 1); // April 1st
    const max = new Date(endYear, 2, 31); // March 31st

    this.minDate = this.formatDate(min);
    this.maxDate = this.formatDate(max);
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // Converts to YYYY-MM-DD format
  }

  loadEalTypes(): void {
    this.stockService.ealtypes().subscribe({
      next: (eals) => {
        this.ealTypes = eals;
      },
      error: (error) => {
        console.error('Error fetching months:', error);
      },
    });
  }

  loadPlaceFrom(): void {
    this.stockService.placefrom().subscribe({
      next: (places) => {
        this.placeFromList = places;
        this.stockForm.FromPlace = [...places];
      },
      error: (error) => {
        console.error('Error fetching places:', error);
      },
    });
  }

  // For Existing DC Management
  searchDC: string = '';
  allDCs: any[] = []; // Fetch from your backend
  filteredDCs: any[] = [];
  selectedDC: any = null;
  additionalItems: any[] = [{ selectedEalType: null, BoxNo: '', FromNo: null, FromTo: null }];
  stockItems: any[] = []; // Temporary items being added
  savedStockItems: any[] = []; // Items saved to backend
  saveSuccessMessage: string = '';

  stockForm: any = {
    EntryDate: new Date().toISOString().split('T')[0],
    DC_No: '',
    FromPlace: []
  };
  selectedFromPlace: string = '';

  addStockItem(): void {
    const itemGroup = this.fb.group({
      selectedPackSize: ['ALL'],     // default ALL
      allPackSizes: [this.packSizes.map(p => p.packsizeId)],
      selectedEalType: [''],
      BoxNo: [''],
      FromNo: [null],
      FromTo: [null],
      Remark: [''],
      SpoolType: [''],
      SupplierId: [null]
    });

    this.stockItems.push(itemGroup);
  }
  get isStockFormValid(): boolean {
    return !!this.stockForm.EntryDate && !!this.stockForm.DC_No && !!this.selectedFromPlace;
  }


  removeStockItem(index: number) {
    this.stockItems.splice(index, 1);
  }

  calculateSpoolEnd(index: number) {
    const item = this.stockItems[index];
    item.FromTo = item.FromNo ? Number(item.FromNo) + 90000 - 1 : null;
  }

  isLoading: boolean = false;
  existingDCsData = {
    isData: false,
    FinancialYear: '',
    EntryDate: '',
    DC_No: '',
    FromPlace: '',
    FromPlaceName: '',
    data: []
  };

  autoSearch(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      if (!this.searchDC && !this.searchDate) {
        this.clearSearch();
        return;
      }
      this.searchDcNumber();
    }, 300);
  }

  searchDcNumber(): void {
    if (!this.searchDC && !this.searchDate) {
      this.toastService.show('Please enter DC Number or select Date', { class: 'warning' });
      return;
    }

    this.isLoading = true;

    // Convert date to financial year if selected
    let financialYear = '';
    if (this.searchDate) {
      const date = new Date(this.searchDate);
      const month = date.getMonth() + 1; // January = 1
      const year = date.getFullYear();
      financialYear = month < 4 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
    }

    // Call service
    this.stockService.searchDCs(this.searchDC, financialYear).subscribe({
      next: (response) => {
        this.isLoading = false;

        if (!response || response.length === 0) {
          this.toastService.show('DC No. not found!', { class: 'warning' });
          this.existingDCsData = { isData: false, FinancialYear: '', EntryDate: '', DC_No: '', FromPlace: '', FromPlaceName: '', data: [] };
          this.existingStockItems = [];
          return;
        }

        // Populate existingDCsData
        this.existingDCsData = {
          isData: true,
          FinancialYear: response[0].FinancialYear,
          EntryDate: response[0].EntryDate,
          DC_No: response[0].DC_No,
          FromPlace: response[0].FromPlace,
          FromPlaceName: this.placeFromList.find(p => p.Place_Id == response[0].FromPlace)?.Place_Name || '',
          data: [...response]
        };
      },
      error: (error) => {
        this.isLoading = false;
        this.toastService.show(error.status === 404 ? 'DC No. not found!' : 'Something went wrong!', { class: error.status === 404 ? 'warning' : 'danger' });
        this.existingDCsData = { isData: false, FinancialYear: '', EntryDate: '', DC_No: '', FromPlace: '', FromPlaceName: '', data: [] };
        this.existingStockItems = [];
      }
    });
  }


  clearSearch(): void {
    this.searchDC = '';
    this.searchDate = '';
    this.existingDCsData = {
      isData: false,
      FinancialYear: '',
      EntryDate: '',
      DC_No: '',
      FromPlace: '',
      FromPlaceName: '',
      data: []
    };
  }

  existingStockItems: any[] = [];
  existingSaveSuccessMessage: string = '';

  addExistingStockItem() {
    this.existingStockItems.push({
      selectedEalType: null,
      BoxNo: '',
      FromNo: null,
      FromTo: null,
      Remark: ''
    });
  }

  removeExistingStockItem(index: number) {
    this.existingStockItems.splice(index, 1);
  }

  isFormValid(): boolean {
    return (
      this.currentFinancialYear &&
      this.stockForm.EntryDate &&
      this.stockForm.DC_No?.trim() !== '' &&
      this.selectedFromPlace?.trim() !== '' &&
      this.stockItems.length > 0 &&
      this.stockItems.every(item =>
        item.selectedEalType?.trim() !== '' &&
        item.BoxNo?.trim() !== '' &&
        item.FromNo != null &&
        item.FromTo != null
      )
    );
  }


  calculateExistingSpoolEnd(index: number) {
    const item = this.existingStockItems[index];
    item.FromTo = item.FromNo ? Number(item.FromNo) + 90000 - 1 : null;
  }

  private isRemarkSafe(remark: string): boolean {
    const trimmed = remark?.trim() || '';

    // Block <, >, "script", event handlers, equal signs, comment markers, and dot (.)
    const unsafePattern = /[<>]/i;
    const scriptPattern = /script/i;
    const eventHandlerPattern = /\bon\w+\s*=/i;
    const assignmentPattern = /=/;
    const commentPattern = /\/\//;
    const dotPattern = /\./;

    return !(unsafePattern.test(trimmed) ||
      scriptPattern.test(trimmed) ||
      eventHandlerPattern.test(trimmed) ||
      assignmentPattern.test(trimmed) ||
      commentPattern.test(trimmed) ||
      dotPattern.test(trimmed));
  }


  saveAllStockAction(action: string): void {
    this.globalStatus = action;
    const modalId = `#${this.globalStatus}`;

    if (!this.isFormValid()) {
      this.toastService.show('Please fill all required fields.', { class: 'warning' });
      return;
    }

    if (action === 'new') {
      const ind = this.selectedIndent;
      if (!ind) {
        this.toastService.show('Select the approved Indent No. for this dispatch.', { class: 'warning' });
        return;
      }
      // boxes per EAL type must fit what the indent still needs
      for (const line of ind.Items) {
        const entered = this.stockItems.filter(it => Number(it.selectedEalType) === Number(line.EALTypeId)).length;
        if (entered > line.BalanceBoxes) {
          this.toastService.show(`Indent ${ind.IndentNo}: only ${line.BalanceBoxes} box(es) of ${line.ComponentName} left.`, { class: 'warning' });
          return;
        }
      }
      const notInIndent = this.stockItems.find(it => !ind.Items.some((l: any) => Number(l.EALTypeId) === Number(it.selectedEalType)));
      if (notInIndent) {
        this.toastService.show(`Indent ${ind.IndentNo} does not include that EAL type.`, { class: 'warning' });
        return;
      }
    }

    // 🚫 BLOCK SCRIPT / HTML INJECTION
    for (let item of this.stockItems) {
      const remark = item.Remark?.trim() || '';
      if (!this.isRemarkSafe(remark)) {
        this.toastService.show(
          'Invalid input detected in Remark. Data not saved.',
          { class: 'danger' }
        );
        return; // ❌ STOP HERE — API will NOT be called
      }
    }


    const selectedDate = new Date(this.stockForm.EntryDate);
    const month = selectedDate.getMonth() + 1;

    const cleanedData = this.stockItems.map(item => ({
      EALType: String(item.selectedEalType),
      selectedEalType: String(item.selectedEalType),
      BoxNo: String(item.BoxNo),
      FromNo: Number(item.FromNo),
      FromTo: Number(item.FromTo),
      Remark: item.Remark?.trim() || '',
      PackSizeId: Number(item.selectedPackSize),
      SupplierId: item.SupplierId || 0
    }));

    const payload = {
      type: action,
      FinancialYear: this.currentFinancialYear,
      EntryDate: this.stockForm.EntryDate,
      DC_No: String(this.stockForm.DC_No),
      FromPlace: String(this.selectedFromPlace),
      Month: month,
      IndentNo: action === 'new' ? this.selectedIndentNo : '',   // existing DC keeps its own indent
      data: cleanedData
    };

    this.stockService.createStock(payload).subscribe({
      next: (res: any) => {
        this.toastService.show(res?.message || 'Stock saved successfully!', { class: 'success' });
        this.selectedIndentNo = '';
        this.loadOpenIndents();
        $(modalId).modal('hide');
        this.resetForm();
      },
      error: (error) => {
        $(modalId).modal('hide');
        const errorMessage =
          error.error?.message === 'Box already exists'
            ? 'Box-ID already exists!'
            : error.error?.message || 'Something went wrong!';
        this.toastService.show(errorMessage, { class: 'danger' });
      }
    });
  }


  // saveAllStockAction(action: string): void {
  //   this.globalStatus = action;
  //   const modalId = `#${this.globalStatus}`;

  //   if (!this.isFormValid()) {
  //     this.toastService.show('Please fill all required fields.', { class: 'warning' });
  //     return;
  //   }

  //   // 🚫 BLOCK SCRIPT / HTML INJECTION
  //   for (let item of this.stockItems) {
  //     const remark = item.Remark?.trim() || '';

  //     // block < > and script word
  //     if (/[<>]/.test(remark) || /script/i.test(remark)) {
  //       this.toastService.show(
  //         'Invalid input detected in Remark. Data not saved.',
  //         { class: 'danger' }
  //       );
  //       return; // ❌ STOP HERE — API will NOT be called
  //     }
  //   }

  //   const selectedDate = new Date(this.stockForm.EntryDate);
  //   const month = selectedDate.getMonth() + 1;

  //   const cleanedData = this.stockItems.map(item => ({
  //     EALType: String(item.selectedEalType),
  //     selectedEalType: String(item.selectedEalType),
  //     BoxNo: String(item.BoxNo),
  //     FromNo: Number(item.FromNo),
  //     FromTo: Number(item.FromTo),
  //     Remark: item.Remark?.trim() || '',
  //     PackSizeId: Number(item.selectedPackSize),
  //     SupplierId: item.SupplierId || 0
  //   }));

  //   const payload = {
  //     type: action,
  //     FinancialYear: this.currentFinancialYear,
  //     EntryDate: this.stockForm.EntryDate,
  //     DC_No: String(this.stockForm.DC_No),
  //     FromPlace: String(this.selectedFromPlace),
  //     Month: month,
  //     data: cleanedData
  //   };

  //   this.stockService.createStock(payload).subscribe({
  //     next: () => {
  //       this.toastService.show('Stock saved successfully!', { class: 'success' });
  //       $(modalId).modal('hide');
  //       this.resetForm();
  //     },
  //     error: (error) => {
  //       $(modalId).modal('hide');
  //       const errorMessage =
  //         error.error?.message === 'Box already exists'
  //           ? 'Box-ID already exists!'
  //           : error.error?.message || 'Something went wrong!';
  //       this.toastService.show(errorMessage, { class: 'danger' });
  //     }
  //   });
  // }



  private resetForm(): void {
    // Reset main form controls
    this.stockForm.reset();

    // Set default values again
    this.stockForm.patchValue({
      financialYear: this.currentFinancialYear,
      entryDate: new Date().toISOString().split('T')[0],
      dcNo: '',
      fromPlace: ''
    });

    // ✅ Clear FormArray properly
    const stockArray = this.stockForm.get('stockItems') as FormArray;
    if (stockArray && stockArray.length > 0) {
      stockArray.clear(); // Angular 8+ has clear() method
    }

    // Clear normal arrays
    this.stockItems = [];
    this.existingStockItems = [];

    // Reset extra variables
    this.selectedFromPlace = '';
    this.dcExists = false;

    this.startBoxNo = '';
    this.endBoxNo = '';
    this.lastSpoolEnd = '';
    this.startSpoolNo = '';
    this.endSpoolNo = '';
    this.enteredBoxQty = '';

    this.globalStatus = '';
  }



  // saveAllStockAction(action: string): void {
  //   this.globalStatus = action;
  //   const modalId = `#${this.globalStatus}`;

  //   if (!this.isFormValid()) {
  //     this.toastService.show('Please fill all required fields.', { class: 'warning' });
  //     return;
  //   }

  //   const selectedDate = new Date(this.stockForm.EntryDate);
  //   const month = selectedDate.getMonth() + 1;

  //   const cleanedData = this.stockItems.map(item => ({
  //     // Backend requires EALType
  //     EALType: String(item.selectedEalType),
  //     selectedEalType: String(item.selectedEalType), // keep if UI still uses it
  //     BoxNo: String(item.BoxNo),
  //     FromNo: Number(item.FromNo),
  //     FromTo: Number(item.FromTo),
  //     Remark: item.Remark?.trim() || '',
  //     PackSizeId: Number(item.selectedPackSize),
  //     SupplierId: item.SupplierId || 0 // backend accepts SupplierId
  //   }));

  //   const payload = {
  //     type: action,
  //     FinancialYear: this.currentFinancialYear,
  //     EntryDate: this.stockForm.EntryDate,
  //     DC_No: String(this.stockForm.DC_No),
  //     FromPlace: String(this.selectedFromPlace),
  //     Month: month,
  //     data: cleanedData
  //   };

  //   // console.log("FINAL PAYLOAD SENT TO API:", JSON.stringify(payload, null, 2));

  //   this.stockService.createStock(payload).subscribe({
  //     next: () => {
  //       this.toastService.show('Stock saved successfully!', { class: 'success' });
  //       $(modalId).modal('hide');

  //       // Reset form
  //       this.stockItems = [];
  //       this.stockForm.EntryDate = new Date().toISOString().split('T')[0];
  //       this.stockForm.DC_No = '';
  //       this.selectedFromPlace = '';
  //     },
  //     error: (error) => {
  //       $(modalId).modal('hide');
  //       const errorMessage =
  //         error.error?.message === 'Box already exists'
  //           ? 'Box-ID already exists!'
  //           : error.error?.message || 'Something went wrong!';
  //       this.toastService.show(errorMessage, { class: 'danger' });
  //     }
  //   });
  // }

  async confirmModalAction(actionType: string) {
    const month = this.stockForm.EntryDate
      ? new Date(this.stockForm.EntryDate).getMonth() + 1
      : 0;

    const cleanedData = this.stockItems.map(item => ({
      EALType: String(item.selectedEalType),
      selectedEalType: String(item.selectedEalType),
      BoxNo: String(item.BoxNo),
      FromNo: Number(item.FromNo),
      FromTo: Number(item.FromTo),
      Remark: item.Remark?.trim() || '',
      PackSizeId: Number(item.selectedPackSize),
      SupplierId: item.SupplierId || 0
    }));

    const payload = {
      type: actionType,
      FinancialYear: this.currentFinancialYear,
      EntryDate: this.stockForm.EntryDate,
      DC_No: String(this.stockForm.DC_No),
      FromPlace: String(this.selectedFromPlace),
      Month: month,
      data: cleanedData
    };

    // console.log(`PAYLOAD (${actionType}):`, JSON.stringify(payload, null, 2));

    this.stockService.createStock(payload).subscribe({
      next: () => {
        this.toastService.show('Stock saved successfully!', { class: 'success' });
        $(`#${actionType}`).modal('hide');

        if (actionType === 'existing') {
          this.existingStockItems = [];
          this.existingDCsData = {
            isData: false,
            FinancialYear: '',
            EntryDate: '',
            DC_No: '',
            FromPlace: '',
            FromPlaceName: '',
            data: []
          };
          this.searchDcNumber();
        } else {
          this.stockForm = {
            EntryDate: new Date().toISOString().split('T')[0],
            DC_No: '',
            FromPlace: ''
          };
          this.selectedFromPlace = '';
          this.stockItems = [];
          this.ngOnInit();
        }
      },
      error: (error) => {
        $(`#${actionType}`).modal('hide');
        const errorMessage =
          error.error?.message === 'Box already exists'
            ? 'Box-ID already exists!'
            : error.error?.message || 'Something went wrong!';
        this.toastService.show(errorMessage, { class: 'danger' });
      }
    });
  }

  // ---------------- UPDATE BOX RANGE ----------------
  updateBoxRange(): void {
    const qty = Number(this.enteredBoxQty);

    if (!qty || qty <= 0) {
      this.lastBoxNo = this.startBoxNo = this.endBoxNo = '';
      this.lastSpoolEnd = this.startSpoolNo = this.endSpoolNo = '';
      return;
    }

    this.stockService.getBoxDetails(qty).subscribe({
      next: (res) => {
        this.lastBoxNo = res.lastBoxNo.toString();
        this.startBoxNo = res.startBoxNo.toString();
        this.endBoxNo = res.endBoxNo.toString();
        this.lastSpoolEnd = res.lastSpoolEnd.toString();
        this.startSpoolNo = res.startSpoolNo.toString();
        this.endSpoolNo = res.endSpoolNo.toString();

        this.stockItems.forEach((item, index) => {
          item.BoxNo = (res.startBoxNo + index).toString();
          item.FromNo = res.startSpoolNo + index * 90000;
          item.FromTo = item.FromNo + 90000 - 1;
        });
      },
      error: () => {
        this.lastBoxNo = this.startBoxNo = this.endBoxNo = '';
        this.lastSpoolEnd = this.startSpoolNo = this.endSpoolNo = '';
      }
    });
  }

  sanitizeRemark(item: any) {
    if (item.Remark) {
      item.Remark = item.Remark
        .replace(/<script.*?>.*?<\/script>/gi, '')
        .replace(/[<>]/g, '');
    }
  }


  cancelModalAction(type: string) {
    // console.log('Cancel button clicked');
    // $('#dialogBox').modal('hide');
    $(`#${type}`).modal('hide');

  }
}
