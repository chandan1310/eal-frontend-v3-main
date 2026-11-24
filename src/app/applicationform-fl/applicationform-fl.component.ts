import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HoloserviceService } from '../services/holoservice.service';
import { PurOrderService } from '../services/pur-order.service';
import { NgMultiSelectDropDownModule, IDropdownSettings } from 'ng-multiselect-dropdown';
import { StockService } from '../services/stock.service';
import { ToastService } from '../services/toast.service';
import { ApplicationformService } from '../services/applicationform.service';

@Component({
  selector: 'app-applicationform-fl',
  standalone: true,
  imports: [
    SidebarComponent,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgMultiSelectDropDownModule,
  ],
  providers: [HoloserviceService],
  templateUrl: './applicationform-fl.component.html',
  styleUrl: './applicationform-fl.component.css'
})
export class ApplicationformflComponent implements OnInit {
  currentFinancialYear: string = '';
  allMonths: any[] = [];
  designations: string[] = [];
  dropdownList: any[] = [];
  dropdownSettings: IDropdownSettings = {};
  districts: any[] = [];
  applicationForm: FormGroup;
  ealTypes: any[] = [];
  challanData: any[] = [];
  imagePreview: string | ArrayBuffer | null = null;
  poLoader: boolean = true;
  challanLoader: boolean = true;
  authorisedPersons: any[] = [];
  bottlingUnits: any[] = [];

  // PO & Challan Filters (including EAL Type filter for EAL-Type-based FIFO)
  poFilters = {
    search: '',
    month: '',
    year: '',
    date: '',
    ealType: ''
  };

  challanFilters = {
    search: '',
    month: '',
    year: '',
    date: ''
  };

  // PO Details Modal State
  showPoDetailModal: boolean = false;
  poDetailLoading: boolean = false;
  selectedPoDetailData: any = null;

  totalHologramLabels: number = 0;
  private labelCost: number = 0.45;
  private labelBatchSize: number = 1000;
  totalEnteredQuantity = 0;
  currentStep2 = 0;
  steps2 = [
    '1. Company Details',
    '2. Purchase Order & Challan Details',
    '3. Demand Details & Submit Application',
  ];

  // Usage Breakdown Metrics (PO & Challan)
  selectedPoGrossEalQuantity = 0;
  selectedPoPreviouslyUsedQuantity = 0;
  totalQuantity = 0;

  selectedChallanGrossAmount = 0;
  selectedChallanPreviouslyUsedAmount = 0;
  totalChallanAmount = 0;

  selectedEALTypes: Set<number> = new Set();

  constructor(
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private POService: PurOrderService,
    private stockService: StockService,
    private toastService: ToastService,
    private router: Router,
    private applicationFormService: ApplicationformService
  ) {
    this.applicationForm = this.fb.group({
      step0Form: this.fb.group({
        purchaseOrders: this.fb.array([]),
        challans: this.fb.array([]),
        financialYear: [this.currentFinancialYear],
        approvedPOAmount: [{ value: '' }],
        approvedChallanAmount: [{ value: '' }],
      }),

      step1Form: this.fb.group({
        companyName: [null, Validators.required],
        address: [null, Validators.required],
        state: [null, Validators.required],
        district: [null, Validators.required],
        pin: [null, Validators.required],
        modeOfTransport: [null, Validators.required],
        route: [null, Validators.required],
        authPersonName: [null, Validators.required],
        authPersonMobile: [null, [Validators.required, Validators.pattern('^[0-9]{10}$')]],
        authPersonAddres: [null, Validators.required],
        PersonName: [null, Validators.required],
        designation: ['', Validators.required],
        photo: [null, Validators.required],
        photoSource: [null],
        bottlingUnitId: ['', Validators.required],
      }),

      step2Form: this.fb.group({
        quantities: this.fb.array([], [this.totalQuantityValidator()]),
        checkboxControl: [false, Validators.requiredTrue]
      })
    });

    this.step1Form?.get('companyName')?.disable();
    this.step1Form?.get('address')?.disable();
    this.step1Form?.get('pin')?.disable();
    this.step1Form?.get('modeOfTransport')?.disable();
    this.step1Form?.get('route')?.disable();
    this.step1Form?.get('state')?.disable();
    this.step1Form?.get('district')?.disable();
  }

  ngOnInit(): void {
    this.getCurrentFinancialYear();
    this.loadDesignations();
    this.loadAllMonths();
    this.loadSupplierDetails();
    this.loadDistricts();
    this.loadEalTypes();
    this.loadSupplierPurchaseOrderDetails();
    this.loadSupplierChallanDetails();
    this.loadAuthorisedPersons();
    this.loadBottlingUnits();
  }

  get availablePoEalTypes(): string[] {
    const set = new Set<string>();
    this.dropdownList.forEach(po => {
      const name = this.getEALTypeName(po);
      if (name && name !== 'N/A') set.add(name);
    });
    return Array.from(set);
  }

  get activeSelectedPoEalType(): string {
    if (this.purchaseOrderArray.length > 0) {
      return this.getEALTypeName(this.purchaseOrderArray.at(0).value);
    }
    return this.poFilters.ealType || '';
  }

  get filteredPurchaseOrders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.dropdownList.filter(po => {
      const remQty = this.getPoRemainingEalQty(po);
      if (remQty <= 0) return false;

      if (po.ValidUpto) {
        const validDate = new Date(po.ValidUpto);
        validDate.setHours(0, 0, 0, 0);
        if (validDate < today) return false;
      }

      const poEalName = this.getEALTypeName(po);
      const matchesEalType = !this.poFilters.ealType || poEalName === this.poFilters.ealType;

      const poDate = po.PurchaseOrderDate ? new Date(po.PurchaseOrderDate) : null;
      const matchesSearch = !this.poFilters.search || po.PurchaseOrderNo?.toLowerCase().includes(this.poFilters.search.toLowerCase());
      const matchesDate = !this.poFilters.date || (poDate && poDate.toISOString().split('T')[0] === this.poFilters.date);
      const matchesMonth = !this.poFilters.month || (poDate && (poDate.getMonth() + 1).toString() === this.poFilters.month);
      const matchesYear = !this.poFilters.year || (poDate && poDate.getFullYear().toString() === this.poFilters.year);

      return matchesEalType && matchesSearch && matchesDate && matchesMonth && matchesYear;
    });
  }

  get filteredChallans() {
    return this.challanData.filter(cd => {
      const remAmt = this.getChallanRemainingAmount(cd);
      if (remAmt <= 0) return false;

      const cdDate = cd.ChallanDate ? new Date(cd.ChallanDate) : null;
      const matchesSearch = !this.challanFilters.search || cd.ChallanNo?.toLowerCase().includes(this.challanFilters.search.toLowerCase());
      const matchesDate = !this.challanFilters.date || (cdDate && cdDate.toISOString().split('T')[0] === this.challanFilters.date);
      const matchesMonth = !this.challanFilters.month || (cdDate && (cdDate.getMonth() + 1).toString() === this.challanFilters.month);
      const matchesYear = !this.challanFilters.year || (cdDate && cdDate.getFullYear().toString() === this.challanFilters.year);
      return matchesSearch && matchesDate && matchesMonth && matchesYear;
    });
  }

  private expandEalCodeToFullName(codeOrName: string): string {
    if (!codeOrName) return '';
    const upper = codeOrName.trim().toUpperCase();
    if (upper === 'ST') return 'SPIRIT';
    if (upper === 'ML') return 'MALT';
    if (upper === 'BR') return 'BEER';
    if (upper === 'PL') return 'PLAIN';
    if (upper === 'MS') return 'MASALA';
    if (upper === 'HB') return 'HOTEL/BAR';
    return codeOrName.trim();
  }

  getEALNameById(id: any): string {
    if (!id) return 'N/A';
    const matched = this.ealTypes.find(e => e.EALTypeId == id || e.Id == id);
    if (!matched) return 'Unknown EAL Type';
    const fullName = this.expandEalCodeToFullName(matched.Name || matched.Code);
    return matched.Type && matched.Type.toUpperCase() !== fullName.toUpperCase()
      ? `${matched.Type} - ${fullName}`
      : fullName;
  }

  getEALTypeName(po: any): string {
    if (po.EALTypeName && po.EALTypeName !== 'N/A') return po.EALTypeName;

    const ealId = po.EALTypeId || (po.Items && po.Items.length > 0 ? po.Items[0].EALTypeId : null);
    if (ealId) {
      const matchedEal = this.ealTypes.find(e => e.EALTypeId == ealId || e.Id == ealId);
      if (matchedEal) {
        const fullName = this.expandEalCodeToFullName(matchedEal.Name || matchedEal.Code);
        return matchedEal.Type && matchedEal.Type.toUpperCase() !== fullName.toUpperCase()
          ? `${matchedEal.Type} - ${fullName}`
          : fullName;
      }
    }

    if (po.Items && po.Items.length > 0 && po.Items[0].EALCode) {
      const expanded = this.expandEalCodeToFullName(po.Items[0].EALCode);
      return `FOREIGN LIQUOR - ${expanded}`;
    }

    return 'N/A';
  }

  getEALTypeBadgeStyle(ealName: string): { [key: string]: string } {
    if (!ealName || ealName.trim().toUpperCase() === 'N/A') {
      return { 'background-color': '#475569', 'color': '#ffffff' };
    }
    const upper = ealName.trim().toUpperCase();

    if (upper.includes('SPIRIT') || upper === 'ST') {
      return { 'background-color': '#0b5ed7', 'color': '#ffffff' };
    }
    if (upper.includes('MALT') || upper.includes('BEER') || upper === 'ML' || upper === 'BR') {
      return { 'background-color': '#eab308', 'color': '#111827' };
    }
    if (upper.includes('PLAIN') || upper === 'PL') {
      return { 'background-color': '#15803d', 'color': '#ffffff' };
    }
    if (upper.includes('MASALA') || upper === 'MS') {
      return { 'background-color': '#0284c7', 'color': '#ffffff' };
    }
    if (upper.includes('HOTEL') || upper === 'HB') {
      return { 'background-color': '#dc2626', 'color': '#ffffff' };
    }

    return { 'background-color': '#0b5ed7', 'color': '#ffffff' };
  }

  getEALTypeBadgeClass(ealName: string): string {
    if (!ealName) return 'bg-secondary text-white';
    const upper = ealName.trim().toUpperCase();

    if (upper.includes('SPIRIT') || upper === 'ST') return 'bg-primary text-white';
    if (upper.includes('MALT') || upper.includes('BEER') || upper === 'ML' || upper === 'BR') return 'bg-warning text-dark';
    if (upper.includes('PLAIN') || upper === 'PL') return 'bg-success text-white';
    if (upper.includes('MASALA') || upper === 'MS') return 'bg-info text-dark';
    if (upper.includes('HOTEL') || upper === 'HB') return 'bg-danger text-white';
    if (upper === 'N/A') return 'bg-secondary text-white';

    return 'bg-primary text-white';
  }

  openPoDetailsModal(po: any): void {
    this.showPoDetailModal = true;
    this.poDetailLoading = true;
    this.selectedPoDetailData = null;

    const fallbackEalType = this.getEALTypeName(po);

    const normalizeDetail = (raw: any) => {
      const totalEal = Number(raw.TotalEALQuantity ?? this.getPoTotalEalQty(po));
      const usedEal = Number(raw.UsedEALQuantity ?? this.getPoUsedEalQty(po));
      const remEal = Math.max(0, totalEal - usedEal);

      let resolvedEal = raw.EALType;
      if (!resolvedEal || resolvedEal === 'N/A') {
        resolvedEal = this.getEALNameById(raw.EALTypeId);
      }
      if (!resolvedEal || resolvedEal === 'N/A' || resolvedEal === 'Unknown EAL Type') {
        resolvedEal = fallbackEalType;
      }

      let computedStatus = 'Approved';
      if (remEal === 0) computedStatus = 'Fully Used';
      else if (usedEal > 0) computedStatus = 'Partially Used';

      return {
        ...raw,
        EALType: resolvedEal,
        TotalEALQuantity: totalEal,
        UsedEALQuantity: usedEal,
        RemainingEALQuantity: remEal,
        ComputedStatus: computedStatus
      };
    };

    if (!po.Pur_OrderId) {
      this.selectedPoDetailData = normalizeDetail(po);
      this.poDetailLoading = false;
      return;
    }

    this.POService.getPurchaseOrderDetailsById(Number(po.Pur_OrderId)).subscribe({
      next: (res) => {
        this.selectedPoDetailData = normalizeDetail(res);
        this.poDetailLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching PO details:', err);
        this.selectedPoDetailData = normalizeDetail(po);
        this.poDetailLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closePoDetailsModal(): void {
    this.showPoDetailModal = false;
    this.selectedPoDetailData = null;
  }

  // --- ALLOCATION & REMAINING HELPERS ---
  get currentAllocatedEalQuantity(): number {
    return this.totalEnteredQuantity > 0 ? this.totalEnteredQuantity : 0;
  }

  get remainingPoEalAfterCurrentAllocation(): number {
    return Math.max(0, this.totalQuantity - this.currentAllocatedEalQuantity);
  }

  get currentAllocatedChallanAmount(): number {
    const requiredAmt = Math.round(this.currentAllocatedEalQuantity * this.labelCost * 100) / 100;
    return Math.min(this.totalChallanAmount, requiredAmt);
  }

  get remainingChallanAmountAfterCurrentAllocation(): number {
    return Math.max(0, Math.round((this.totalChallanAmount - this.currentAllocatedChallanAmount) * 100) / 100);
  }

  getPoTotalEalQty(po: any): number {
    return Number(po.TotalEALQuantity ?? po.totalPOQty ?? po.TotalQty ?? 0);
  }

  getPoUsedEalQty(po: any): number {
    return Number(po.UsedEALQuantity ?? po.EAL_UsedQty ?? po.UsedQty ?? 0);
  }

  getPoRemainingEalQty(po: any): number {
    const total = this.getPoTotalEalQty(po);
    const used = this.getPoUsedEalQty(po);
    return Math.max(0, total - used);
  }

  getChallanTotalAmount(cd: any): number {
    return Number(cd.Amount ?? cd.ChallanAmount ?? 0);
  }

  getChallanUsedAmount(cd: any): number {
    return Number(cd.EAL_UsedAmount ?? cd.UsedAmount ?? 0);
  }

  getChallanRemainingAmount(cd: any): number {
    const total = this.getChallanTotalAmount(cd);
    const used = this.getChallanUsedAmount(cd);
    return Math.max(0, total - used);
  }

  // --- EAL-TYPE SCOPED FIFO PO SELECTION ---
  onEalTypeFilterChange(): void {
    if (this.poFilters.ealType && this.purchaseOrderArray.length > 0) {
      const currentSelectedType = this.getEALTypeName(this.purchaseOrderArray.at(0).value);
      if (currentSelectedType !== this.poFilters.ealType) {
        this.dropdownList.forEach(p => (p.isSelected = false));
        this.purchaseOrderArray.clear();
        this.calculateTotal();
      }
    }
  }

  onPurchaseOrderChange(po: any, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    const targetEalType = this.getEALTypeName(po);

    if (isChecked) {
      if (this.purchaseOrderArray.length > 0) {
        const existingEalType = this.getEALTypeName(this.purchaseOrderArray.at(0).value);
        if (existingEalType !== targetEalType) {
          po.isSelected = false;
          (event.target as HTMLInputElement).checked = false;
          this.toastService.show(
            `Cannot mix different EAL Types (${existingEalType} and ${targetEalType}) in the same allocation.`,
            { class: 'danger' }
          );
          return;
        }
      }

      const sameTypeActivePos = this.dropdownList
        .filter(item => this.getEALTypeName(item) === targetEalType && this.getPoRemainingEalQty(item) > 0)
        .sort((a, b) => new Date(a.PurchaseOrderDate).getTime() - new Date(b.PurchaseOrderDate).getTime());

      const clickedIndex = sameTypeActivePos.findIndex(item => item.PurchaseOrderNo === po.PurchaseOrderNo);
      for (let i = 0; i < clickedIndex; i++) {
        if (!sameTypeActivePos[i].isSelected) {
          po.isSelected = false;
          (event.target as HTMLInputElement).checked = false;
          this.toastService.show(
            `FIFO Rule (${targetEalType}): Please select older Purchase Order (${sameTypeActivePos[i].PurchaseOrderNo}) first!`,
            { class: 'danger' }
          );
          return;
        }
      }

      if (!this.poFilters.ealType && targetEalType !== 'N/A') {
        this.poFilters.ealType = targetEalType;
      }

      this.purchaseOrderArray.push(this.fb.control(po));
    } else {
      const sameTypeActivePos = this.dropdownList
        .filter(item => this.getEALTypeName(item) === targetEalType && this.getPoRemainingEalQty(item) > 0)
        .sort((a, b) => new Date(a.PurchaseOrderDate).getTime() - new Date(b.PurchaseOrderDate).getTime());

      const clickedIndex = sameTypeActivePos.findIndex(item => item.PurchaseOrderNo === po.PurchaseOrderNo);
      for (let i = clickedIndex + 1; i < sameTypeActivePos.length; i++) {
        if (sameTypeActivePos[i].isSelected) {
          po.isSelected = true;
          (event.target as HTMLInputElement).checked = true;
          this.toastService.show(
            `FIFO Rule (${targetEalType}): Unselect newer PO (${sameTypeActivePos[i].PurchaseOrderNo}) first!`,
            { class: 'danger' }
          );
          return;
        }
      }

      const index = this.purchaseOrderArray.controls.findIndex(
        (ctrl) => ctrl.value.PurchaseOrderNo === po.PurchaseOrderNo
      );
      if (index !== -1) {
        this.purchaseOrderArray.removeAt(index);
      }

      if (this.purchaseOrderArray.length === 0) {
        this.poFilters.ealType = '';
      }
    }

    this.calculateTotal();
  }

  onChallanChange(challan: any, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;

    if (isChecked) {
      if (this.getChallanRemainingAmount(challan) <= 0) {
        challan.isSelected = false;
        (event.target as HTMLInputElement).checked = false;
        this.toastService.show('Selected Challan has zero remaining balance.', { class: 'danger' });
        return;
      }
      this.challanArray.push(this.fb.control(challan));
    } else {
      const index = this.challanArray.controls.findIndex(
        (ctrl) => ctrl.value.ChallanNo === challan.ChallanNo
      );
      if (index !== -1) {
        this.challanArray.removeAt(index);
      }
    }

    this.calculateTotal();
  }

  calculateTotal() {
    this.selectedPoGrossEalQuantity = this.purchaseOrderArray.value.reduce(
      (sum, po) => sum + this.getPoTotalEalQty(po), 0
    );
    this.selectedPoPreviouslyUsedQuantity = this.purchaseOrderArray.value.reduce(
      (sum, po) => sum + this.getPoUsedEalQty(po), 0
    );
    this.totalQuantity = this.purchaseOrderArray.value.reduce(
      (sum, po) => sum + this.getPoRemainingEalQty(po), 0
    );

    this.selectedChallanGrossAmount = this.challanArray.value.reduce(
      (sum, cd) => sum + this.getChallanTotalAmount(cd), 0
    );
    this.selectedChallanPreviouslyUsedAmount = this.challanArray.value.reduce(
      (sum, cd) => sum + this.getChallanUsedAmount(cd), 0
    );
    this.totalChallanAmount = this.challanArray.value.reduce(
      (sum, cd) => sum + this.getChallanRemainingAmount(cd), 0
    );

    this.totalEnteredQuantity = this.quantities.controls.reduce((sum: number, control: AbstractControl) => {
      const qty = control.get('quantity')?.value;
      return sum + (qty ? +qty : 0);
    }, 0);

    const initialLabels = Math.floor(this.totalChallanAmount / this.labelCost);
    this.totalHologramLabels = Math.floor(initialLabels / this.labelBatchSize) * this.labelBatchSize;

    this.quantities.updateValueAndValidity();
  }

  // --- DATA LOADERS ---
  loadBottlingUnits(): void {
    this.stockService.getBottlingUnits().subscribe({
      next: (data: any[]) => { this.bottlingUnits = data; },
      error: (err) => console.error('Error fetching bottling units:', err)
    });
  }

  loadAuthorisedPersons(): void {
    const sessionSupplierId = sessionStorage.getItem('SupplierId') || sessionStorage.getItem('supplierId');
    const supplierId = Number(sessionSupplierId);
    if (!supplierId) return;

    this.stockService.getAuthPersons(supplierId).subscribe({
      next: (data: any[]) => {
        // one entry per person, even if the API returns repeats
        this.authorisedPersons = (data || []).filter((p, i, all) =>
          i === all.findIndex(x => x.AuthPersonId === p.AuthPersonId));
      },
      error: (err) => console.error('Error fetching authorised persons:', err)
    });
  }

  onAuthPersonSelect(event: any): void {
    const selectedName = event.target.value;
    const selectedPerson = this.authorisedPersons.find(p => p.AuthPersonName === selectedName);

    if (selectedPerson) {
      this.step1Form?.patchValue({
        authPersonMobile: selectedPerson.AuthPersonMobile,
        authPersonAddres: selectedPerson.AuthPersonAddress,
        PersonName: selectedPerson.PersonName,
        designation: selectedPerson.Designation,
        photo: selectedPerson.PhotoPath
      });

      this.imagePreview = selectedPerson.PhotoPath ? 'http://localhost:5082' + selectedPerson.PhotoPath : null;
    }
  }

  loadDesignations() {
    this.applicationFormService.getDesignations().subscribe({
      next: (data: any[]) => {
        this.designations = Array.from(new Set(data.map(item => item.Designation)));
      },
      error: (err) => console.error('Error fetching designations', err)
    });
  }

  get step1Form(): FormGroup | null { return this.applicationForm.get('step1Form') as FormGroup | null; }
  get step2Form(): FormGroup | null { return this.applicationForm.get('step2Form') as FormGroup | null; }
  get step0Form(): FormGroup | null { return this.applicationForm.get('step0Form') as FormGroup | null; }
  get purchaseOrderArray(): FormArray { return this.applicationForm.get('step0Form.purchaseOrders') as FormArray; }
  get challanArray(): FormArray { return this.applicationForm.get('step0Form.challans') as FormArray; }
  get quantities(): FormArray<FormGroup> { return this.applicationForm.get('step2Form.quantities') as FormArray<FormGroup>; }

  loadAllMonths(): void {
    this.stockService.getAllMonths().subscribe({
      next: (months) => { this.allMonths = months; },
      error: (error) => console.error('Error fetching months:', error)
    });
  }

  loadDistricts(): void {
    this.stockService.getDistricts().subscribe({
      next: (response) => { this.districts = response; },
      error: (error) => console.error('Error fetching districts:', error)
    });
  }

  getStep1DistrictName(): string {
    const distId = this.step1Form?.get('district')?.value;
    if (!distId) return '';
    const matched = this.districts.find(d => d.dist_id == distId);
    return matched ? matched.dist_name : '';
  }

  loadSupplierDetails(): void {
    const sessionSupplierId = sessionStorage.getItem('SupplierId') || sessionStorage.getItem('supplierId');
    const supplierId = Number(sessionSupplierId);
    if (!supplierId) return;

    this.poLoader = true;
    this.stockService.getCompanyDetails(supplierId).subscribe({
      next: (response: any) => {
        if (this.step1Form) {
          this.step1Form.patchValue({
            companyName: response.CompanyName,
            address: response.Address,
            state: response.State === 'CG' ? 'Chhattisgarh' : response.State,
            pin: response.PinCode,
            modeOfTransport: response.ModeOfTransport,
            route: response.Route
          });

          if (response.District) {
            const matchedDistrict = this.districts.find(
              d => d.dist_name.trim().toLowerCase() === response.District.trim().toLowerCase()
            );
            if (matchedDistrict) {
              this.step1Form.patchValue({ district: matchedDistrict.dist_id });
            }
          }
          this.cdr.detectChanges();
        }
        this.poLoader = false;
      },
      error: (error) => {
        console.error('Error loading details:', error);
        this.poLoader = false;
      }
    });
  }

  loadSupplierPurchaseOrderDetails(): void {
    this.poLoader = true;
    const sessionSupplierId = sessionStorage.getItem('SupplierId') || sessionStorage.getItem('supplierId');
    const supplierId = Number(sessionSupplierId);

    if (!supplierId) {
      this.poLoader = false;
      return;
    }

    this.POService.getPurchaseOrdersBySupplierId(supplierId).subscribe({
      next: (response: any[]) => {
        if (response && response.length > 0) {
          this.dropdownList = response.map((item) => {
            const totalEal = item.TotalEALQuantity ?? item.TotalQty ?? item.totalQty ?? item.Amount ?? item.POAmount ?? 0;
            const usedEal = item.UsedEALQuantity ?? item.UsedQty ?? item.usedQty ?? item.UsedAmount ?? 0;
            return {
              ...item,
              PurchaseOrderNo: item.PurchaseOrderNo || item.purchaseOrderNo || item.poNo,
              PurchaseOrderDate: item.PurchaseOrderDate || item.podate || item.PODate,
              TotalEALQuantity: totalEal,
              UsedEALQuantity: usedEal,
              RemainingEALQuantity: Math.max(0, totalEal - usedEal),
              totalPOQty: totalEal,
              EAL_UsedQty: usedEal,
              isSelected: false
            };
          });

          this.dropdownList.sort((a, b) => new Date(a.PurchaseOrderDate).getTime() - new Date(b.PurchaseOrderDate).getTime());
        } else {
          this.dropdownList = [];
        }
        this.poLoader = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading PO orders:', err);
        this.dropdownList = [];
        this.poLoader = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadSupplierChallanDetails(): void {
    this.challanLoader = true;
    this.POService.getSupplierChallanDetailsFL({ financialYear: this.currentFinancialYear || '2026-2027' }).subscribe({
      next: (response: any) => {
        if (Array.isArray(response)) {
          this.challanData = response.map(item => {
            const totalAmt = Number(item.Amount ?? item.amount ?? 0);
            const usedAmt = Number(item.EAL_UsedAmount ?? item.UsedAmount ?? item.usedAmount ?? 0);
            return {
              ChallanNo: item.ChallanNo || item.challanNo,
              ChallanDate: item.ChallanDate || item.challanDate,
              Amount: totalAmt,
              UsedAmount: usedAmt,
              RemainingAmount: Math.max(0, totalAmt - usedAmt),
              EAL_Status: item.EAL_Status || item.Status,
              EAL_UsedAmount: usedAmt,
              isSelected: false
            };
          });

          this.challanData.sort((a, b) => new Date(a.ChallanDate).getTime() - new Date(b.ChallanDate).getTime());
        } else {
          this.challanData = [];
        }
        this.cdr.detectChanges();
        this.challanLoader = false;
      },
      error: (error) => {
        console.error('Error fetching challans:', error);
        this.challanData = [];
        this.challanLoader = false;
      },
    });
  }

  loadEalTypes(): void {
    this.stockService.ealtypes().subscribe({
      next: (eals) => {
        if (eals.length > 0) {
          this.ealTypes = eals.filter(item => item['Type'] == 'FOREIGN LIQUOR' || item['Type'] == 'FL');
        }
      },
      error: (error) => console.error('Error fetching types:', error)
    });
  }

  onEalTypeChange(index: number) {
    this.selectedEALTypes.clear();
    this.quantities.controls.forEach((group) => {
      const selectedValue = group.get('ealType')?.value;
      if (selectedValue !== null) {
        this.selectedEALTypes.add(Number(selectedValue));
      }
    });

    this.totalEnteredQuantity = this.quantities.controls.reduce((sum: number, control: AbstractControl) => {
      const qty = control.get('quantity')?.value;
      return sum + (qty ? +qty : 0);
    }, 0);

    this.quantities.updateValueAndValidity({ emitEvent: false });
  }

  saveApplication() {
    const quantitiesValue = this.applicationForm.get('step2Form.quantities')?.getRawValue();
    const step1 = this.applicationForm.get('step1Form');

    const totalAppliedDemand = (quantitiesValue || []).reduce(
      (sum: number, curr: any) => sum + Number(curr.quantity || 0), 0
    );

    if (totalAppliedDemand > this.totalQuantity) {
      this.toastService.show(
        `Applied EAL quantity (${totalAppliedDemand}) exceeds selected PO remaining quantity (${this.totalQuantity}).`,
        { class: 'danger' }
      );
      return;
    }

    if (totalAppliedDemand > this.totalHologramLabels) {
      this.toastService.show(
        `Applied EAL quantity (${totalAppliedDemand}) exceeds permissible hologram volume (${this.totalHologramLabels}).`,
        { class: 'danger' }
      );
      return;
    }

    let remainingDemand = totalAppliedDemand;
    const orderedSelectedPos = [...this.purchaseOrderArray.value].sort(
      (a, b) => new Date(a.PurchaseOrderDate).getTime() - new Date(b.PurchaseOrderDate).getTime()
    );

    const applicationData = {
      Company_Name: step1?.get('companyName')?.value || '',
      Address: step1?.get('address')?.value || '',
      District: step1?.get('district')?.value != null ? String(step1.get('district')?.value) : '',
      State: step1?.get('state')?.value || '',
      Pin: step1?.get('pin')?.value ? String(step1.get('pin')?.value) : '',
      ModeOfTransport: step1?.get('modeOfTransport')?.value || '',
      Route: step1?.get('route')?.value || '',
      AuthPersonName: step1?.get('authPersonName')?.value || '',
      AuthPersonPhone: step1?.get('authPersonMobile')?.value ? String(step1.get('authPersonMobile')?.value) : '',
      AuthPersonAdd: step1?.get('authPersonAddres')?.value || '',
      PersonName: step1?.get('PersonName')?.value || '',
      Designation: step1?.get('designation')?.value || '',
      Photo: step1?.get('photo')?.value || '',
      BottlingUnitId: step1?.get('bottlingUnitId')?.value ? Number(step1?.get('bottlingUnitId')?.value) : null,
      FinancialYear: this.applicationForm.get('step0Form.financialYear')?.value || this.currentFinancialYear,

      challanDetails: this.challanArray.value.map((challan: any) => ({
        challanDate: challan.ChallanDate,
        challanNo: String(challan.ChallanNo || '').trim(),
        challanAmount: Number(challan.Amount ?? challan.ChallanAmount ?? 0),
        EAL_Status: challan.EAL_Status || null
      })),

      purchaseOrderDetails: orderedSelectedPos.map((po: any) => {
        const poAvailable = this.getPoRemainingEalQty(po);
        const poUsedNow = remainingDemand > 0 ? Math.min(poAvailable, remainingDemand) : 0;
        remainingDemand = Math.max(0, remainingDemand - poUsedNow);
        return {
          PurchaseOrderNo: String(po.PurchaseOrderNo || '').trim(),
          PODate: po.PurchaseOrderDate,
          POAmount: Number(po.Amount || po.POAmount || 0),
          UsedAmount: Number(po.UsedAmount || 0),
          totalPOQty: this.getPoTotalEalQty(po),
          used_qty: poUsedNow,
          EAL_Status: po.EAL_Status || null,
          Pur_OrderId: po.Pur_OrderId ? Number(po.Pur_OrderId) : null
        };
      }),

      demandDetails: (quantitiesValue || []).map((demand: any) => ({
        ealtype: String(demand.ealType || '1'),
        quantity: Number(demand.quantity || 0),
      }))
    };

    this.applicationFormService.saveApplication(applicationData).subscribe({
      next: (res: any) => {
        const appNoMsg = res?.ApplicationNo ? ` (${res.ApplicationNo})` : '';
        this.toastService.show(`Application submitted successfully${appNoMsg}!`, { class: 'success' });
        this.resetForm();
        this.loadSupplierPurchaseOrderDetails();
        this.loadSupplierChallanDetails();
        this.router.navigate(['/my-applications']);
      },
      error: (err) => {
        console.error('Submission failed full error:', err);
        console.error('Backend SQL/Validation message:', err?.error);
        const exactError =
          err?.error?.error ||
          err?.error?.message ||
          (typeof err?.error === 'string' ? err.error : 'Database transaction failed.');
        this.toastService.show(exactError, { class: 'danger' });
      }
    });
  }

  getCurrentFinancialYear(): void {
    const currentDate = new Date();
    let year = currentDate.getFullYear();
    if (currentDate.getMonth() < 3) year--;
    this.currentFinancialYear = `${year}-${year + 1}`;
    this.applicationForm.get('step0Form')?.patchValue({ financialYear: this.currentFinancialYear });
  }

  addDemandRow(ealId: any = null) {
    const newRow = this.fb.group({
      ealType: [{ value: ealId, disabled: ealId !== null }, Validators.required],
      quantity: [null, [
        Validators.required,
        Validators.min(1000),
        this.multipleOf100Validator
      ]]
    });
    this.quantities.push(newRow);

    const index = this.quantities.length - 1;
    this.quantities.at(index).get('ealType')?.valueChanges.subscribe(() => this.onEalTypeChange(index));
    this.quantities.at(index).get('quantity')?.valueChanges.subscribe(() => this.onEalTypeChange(index));
  }

  nextStep2() {
    if (this.currentStep2 === 1 && !this.isStep0Valid()) {
      this.step0Form?.markAllAsTouched();
      return;
    }

    if (this.currentStep2 < this.steps2.length - 1) this.currentStep2++;

    this.quantities.clear();
    this.selectedEALTypes.clear();

    const selectedPOs = this.purchaseOrderArray.value;
    const uniqueEALTypeIds = new Set<number>();

    selectedPOs.forEach((po: any) => {
      if (po.EALTypeId) {
        uniqueEALTypeIds.add(Number(po.EALTypeId));
      } else if (po.Items && po.Items.length > 0) {
        po.Items.forEach((item: any) => {
          if (item.EALTypeId) {
            uniqueEALTypeIds.add(Number(item.EALTypeId));
          }
        });
      }
    });

    if (uniqueEALTypeIds.size > 0) {
      uniqueEALTypeIds.forEach(typeId => {
        const matchedEal = this.ealTypes.find(e => Number(e.EALTypeId || e.Id) === typeId);
        this.addDemandRow(matchedEal ? Number(matchedEal.EALTypeId || matchedEal.Id) : typeId);
      });
    } else {
      this.addDemandRow(1);
    }

    this.calculateTotal();
  }

  multipleOf100Validator(control: AbstractControl): { [key: string]: boolean } | null {
    const value = control.value;
    if (value !== null && value !== undefined && value % 100 !== 0) {
      return { 'invalidMultiple': true };
    }
    return null;
  }

  prevStep() {
    if (this.currentStep2 > 0) this.currentStep2--;
  }

  isStep0Valid(): boolean {
    return this.purchaseOrderArray.length > 0 &&
      this.challanArray.length > 0 &&
      this.totalHologramLabels <= this.totalQuantity &&
      this.totalHologramLabels > 0;
  }

  totalQuantityValidator() {
    return (formArray: FormArray) => {
      const total = formArray.controls.reduce((sum: number, control: AbstractControl) => {
        const qty = control.get('quantity')?.value;
        return sum + (qty ? +qty : 0);
      }, 0);

      // Available limit is the lower of Permissible Hologram Volume (Challan) and Selected PO Remaining EAL Qty
      const maxAllowed = Math.min(this.totalHologramLabels, this.totalQuantity);
      return total <= maxAllowed ? null : { exceedsAvailable: true };
    };
  }

  asFormGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }

  resetForm() {
    this.applicationForm.reset();
    this.purchaseOrderArray.clear();
    this.challanArray.clear();
    this.quantities.clear();
    this.poFilters.ealType = '';
    this.currentStep2 = 0;
    this.getCurrentFinancialYear();
    this.loadSupplierDetails();
  }
}