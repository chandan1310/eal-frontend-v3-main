import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HoloserviceService } from '../services/holoservice.service';
import { PurOrderService } from '../services/pur-order.service';
import { NgMultiSelectDropDownModule } from 'ng-multiselect-dropdown';
import { IDropdownSettings } from 'ng-multiselect-dropdown';
import { StockService } from '../services/stock.service';
import { ToastService } from '../services/toast.service';
import { ApplicationformService } from '../services/applicationform.service';
import { SpiritMaltService, MonthlyQuota } from '../services/SpiritMaltService.service';

interface GroupedQuota {
  monthName: string;
  spirit: number;
  malt: number;
}

@Component({
    selector: 'app-applicationform-district',
    standalone: true,
    imports: [
        SidebarComponent,
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        NgMultiSelectDropDownModule,
    ],
    providers: [HoloserviceService],
    templateUrl: './applicationform-district.component.html', // ✅ Fixed Template Url
    styleUrl: './applicationform-district.component.css'
})
export class ApplicationformDistrictComponent implements OnInit {
  currentFinancialYear: string = '';
  allMonths: any[] = [];
  designations: string[] = [];
  districts: any[] = [];
  applicationForm: FormGroup;
  ealTypes: any[] = [];
  challanData: any[] = [];

  imagePreview: string | ArrayBuffer | null = null;
  challanLoader: boolean = true;
  userType: string = null;
  quotas: GroupedQuota[] = [];
  isLoading = true;

  totalSpirit = 0;
  totalMalt = 0;
  averageSpirit = 0;
  averageMalt = 0;

  totalChallanAmount = 0;
  totalHologramLabels: number = 0;
  private labelCost: number = 0.45;
  private labelBatchSize: number = 1000;
  totalEnteredQuantity = 0;

  currentStep2 = 0;
  steps2 = [
    '1. Company Details',
    '2. Enter Demand Matrix',
  ];

  selectedEALTypes: Set<number> = new Set();

  constructor(
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private POService: PurOrderService,
    private stockService: StockService,
    private toastService: ToastService,
    private applicationFormService: ApplicationformService,
    private spiritMaltService: SpiritMaltService
  ) {
    this.applicationForm = this.fb.group({
      step0Form: this.fb.group({
        challans: this.fb.array([]),
        financialYear: [this.currentFinancialYear],
        approvedChallanAmount: [{ value: '' }],
      }),

      step1Form: this.fb.group({
        companyName: [null, Validators.required],
        address: [null, Validators.required],
        state: ['Chhattisgarh', Validators.required],
        district: [28, Validators.required],
        pin: ['492001', Validators.required],
        modeOfTransport: ['By Road', Validators.required],
        route: ['National Highway', Validators.required],
        authPersonName: [null, Validators.required],
        authPersonMobile: [null, [Validators.required, Validators.pattern('^[0-9]{10}$')]],
        authPersonAddres: ['Naya Raipur', Validators.required],
        PersonName: [null, Validators.required],
        designation: ['', Validators.required],
        photo: [null, Validators.required],
      }),
      step2Form: this.fb.group({
        quantities: this.fb.array([], [this.totalQuantityValidator()]),
        checkboxControl: [false, Validators.requiredTrue]
      })
    });

    this.step1Form.get('companyName')?.disable();
    this.step1Form.get('address')?.disable();
    this.step1Form.get('pin')?.disable();
    this.step1Form.get('modeOfTransport')?.disable();
    this.step1Form.get('route')?.disable();
    this.step1Form.get('authPersonName')?.disable();
    this.step1Form.get('authPersonMobile')?.disable();
    this.step1Form.get('authPersonAddres')?.disable();
    this.step1Form.get('district')?.disable();
  }

  ngOnInit(): void {
    this.getCurrentFinancialYear();
    this.loadAllMonths();
    this.loadSupplierDetails();
    this.loadDistricts();
    this.loadEalTypes();
    this.loadSupplierChallanDetails();
    this.loadDesignations();

    const currentMonthId = new Date().getMonth() + 1;
    this.spiritMaltService.getMonthlySpiritMalt().subscribe({
      next: (data) => {
        const currentMonthData = data.filter(q => q.MonthId === currentMonthId);
        this.quotas = this.groupByMonth(currentMonthData);
        this.calculateTotals();
        this.isLoading = false;
      },
      error: (err) => { this.isLoading = false; }
    });
  }

  get step0Form(): FormGroup {
    return this.applicationForm.get('step0Form') as FormGroup;
  }

  get step1Form(): FormGroup {
    return this.applicationForm.get('step1Form') as FormGroup;
  }

  get step2Form(): FormGroup {
    return this.applicationForm.get('step2Form') as FormGroup;
  }

  get challanArray(): FormArray {
    return this.applicationForm.get('step0Form.challans') as FormArray;
  }

  get quantities(): FormArray<FormGroup> {
    return this.applicationForm.get('step2Form.quantities') as FormArray<FormGroup>;
  }

  loadAllMonths(): void {
    this.stockService.getAllMonths().subscribe({
      next: (months) => { this.allMonths = months; },
      error: (error) => { console.error('Error fetching months:', error); }
    });
  }

  loadDistricts(): void {
    this.stockService.getDistricts().subscribe({
      next: (response) => { this.districts = response; },
      error: (error) => { console.error('Error fetching districts:', error); }
    });
  }

  loadSupplierDetails(): void {
    this.POService.getSupplierDetails().subscribe({
      next: (response: any) => {
        if (response && response.length > 0) {
          this.step1Form.patchValue({
            companyName: response[0].supplier_name,
            address: response[0].supplier_address,
            authPersonName: response[0].supplier_name,
            authPersonMobile: response[0].supplier_mobile_no,
          });
        }
      },
      error: (error) => { console.error('Error fetching supplier details:', error); }
    });
  }

  loadSupplierChallanDetails(): void {
    this.challanLoader = true;
    let params = { financialYear: this.currentFinancialYear || '2026-2027' };
    this.POService.getSupplierChallanDetailsFL(params).subscribe({
      next: (response: any) => {
        response.forEach((item) => { item['isSelected'] = false; });
        this.challanData = response;
        this.challanLoader = false;
      },
      error: (error) => {
        console.error('Error fetching challans:', error);
        this.challanLoader = false;
      }
    });
  }

  loadEalTypes(): void {
    this.stockService.ealtypes().subscribe({
      next: (eals) => {
        if (eals.length > 0) {
          this.ealTypes = eals.filter(item => item['Type'] == 'FOREIGN LIQUOR');
        }
      },
      error: (error) => { console.error('Error fetching EAL types:', error); }
    });
  }

  addEalRow(skipValidation = false) {
    if (this.quantities.length === 0) { skipValidation = true; }

    if (!skipValidation && this.selectedEALTypes.size >= this.ealTypes.length) {
      this.toastService.show('All EAL Types are already selected', { class: 'danger' });
      return;
    }

    if (!skipValidation && this.quantities.length > 0) {
      const lastRow = this.quantities.at(this.quantities.length - 1);
      if (!lastRow.get('ealType')?.value) {
        this.toastService.show('Please select an EAL Type before adding a new row.', { class: 'danger' });
        return;
      }
    }

    const newRow = this.fb.group({
      ealType: [null, Validators.required],
      quantity: [null, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    });

    newRow.get('ealType')?.valueChanges.subscribe(() => this.onEalTypeChange(this.quantities.length - 1));
    newRow.get('quantity')?.valueChanges.subscribe(() => this.calculateTotal());

    this.quantities.push(newRow);
  }

  deleteEalRow(index: number) {
    this.quantities.removeAt(index);
    this.onEalTypeChange(index);
  }

  onEalTypeChange(index: number) {
    this.selectedEALTypes.clear();
    this.quantities.controls.forEach((group) => {
      const selectedValue = group.get('ealType')?.value;
      if (selectedValue !== null) {
        this.selectedEALTypes.add(Number(selectedValue));
      }
    });
    this.calculateTotal();
  }

  getAvailableEALTypes(index: number) {
    return this.ealTypes.filter(
      (eal) => !this.selectedEALTypes.has(eal.Id) || this.quantities.at(index).get('ealType')?.value == eal.Id
    );
  }

  onChallanChange(challan: any, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    challan.isSelected = isChecked;

    if (isChecked) {
      const exists = this.challanArray.controls.some(ctrl => ctrl.value.ChallanNo === challan.ChallanNo);
      if (!exists) {
        this.challanArray.push(this.fb.control(challan));
      }
    } else {
      const index = this.challanArray.controls.findIndex((ctrl) => ctrl.value.ChallanNo === challan.ChallanNo);
      if (index !== -1) { this.challanArray.removeAt(index); }
    }

    this.calculateTotal();
    this.cdr.detectChanges();
  }
  calculateTotal() {
    // Calculate based on challans if they exist, otherwise use a default or 0
    const challanSum = this.challanArray.value.reduce((sum: number, cd: any) => {
      if (cd.EAL_Status === 'Partially') { return sum + (cd.EAL_RemainingAmount ?? 0); }
      return sum + (cd.Amount ?? 0);
    }, 0);

    this.totalChallanAmount = challanSum;

    const initialLabels = Math.floor(this.totalChallanAmount / this.labelCost);

    // Use a fallback of 1,000,000 if no challan is selected, 
    // or keep it at 0 if you want to enforce a restriction.
    const fallbackLimit = 1000000;
    this.totalHologramLabels = this.totalChallanAmount > 0
      ? Math.floor(initialLabels / this.labelBatchSize) * this.labelBatchSize
      : fallbackLimit;

    this.totalEnteredQuantity = this.quantities.controls.reduce((sum: number, control: AbstractControl) => {
      const qty = control.get('quantity')?.value;
      return sum + (qty ? +qty : 0);
    }, 0);

    this.step2Form.get('quantities')?.updateValueAndValidity();
  }
  saveBarApplication() {
    const quantitiesValue = this.step2Form.get('quantities')?.getRawValue();

    let applicationData = {
      Company_Name: this.step1Form.get('companyName')?.value || '',
      Address: this.step1Form.get('address')?.value || '',
      District: String(this.step1Form.get('district')?.value ?? ''),
      State: this.step1Form.get('state')?.value || '',
      Pin: this.step1Form.get('pin')?.value || '',
      ModeOfTransport: this.step1Form.get('modeOfTransport')?.value || '',
      Route: this.step1Form.get('route')?.value || '',
      AuthPersonName: this.step1Form.get('authPersonName')?.value || '',
      AuthPersonPhone: this.step1Form.get('authPersonMobile')?.value || '',
      AuthPersonAdd: this.step1Form.get('authPersonAddres')?.value || '',
      PersonName: this.step1Form.get('PersonName')?.value || '',
      Designation: this.step1Form.get('designation')?.value || '',
      Photo: this.step1Form.get('photo')?.value || '',
      FinancialYear: this.applicationForm.get('step0Form.financialYear')?.value || '2026-2027',

      challanDetails: this.challanArray.value.map((challan: any) => ({
        challanDate: challan.ChallanDate,
        challanNo: challan.ChallanNo,
        challanAmount: challan.Amount,
        EAL_Status: challan.EAL_Status || null
      })),

      purchaseOrderDetails: [],

      demandDetails: quantitiesValue?.map((demand: any) => ({
        ealtype: demand.ealType.toString(),
        quantity: Number(demand.quantity || 0),
      })) || [],
    };

    this.applicationFormService.saveApplication(applicationData).subscribe({
      next: () => {
        this.toastService.show('Application submitted successfully!', { class: 'success' });
        this.resetForm();
        setTimeout(() => { window.location.reload(); }, 500);
      },
      error: (error) => {
        console.error('Error submitting form:', error);
        this.toastService.show('Something Went Wrong', { class: 'danger' });
      }
    });
  }

  getCurrentFinancialYear(): void {
    const currentDate = new Date();
    let year = currentDate.getFullYear();
    if (currentDate.getMonth() < 3) { year--; }
    this.currentFinancialYear = `${year}-${year + 1}`;
    this.applicationForm.get('step0Form')?.patchValue({ financialYear: this.currentFinancialYear });
  }

  nextStep2() {
    if (this.currentStep2 < this.steps2.length - 1) {
      this.currentStep2++;
      if (this.currentStep2 === 1 && this.quantities.length === 0) {
        this.addEalRow(true);
      }
      this.cdr.detectChanges();
    }
  }

  prevStep() {
    if (this.currentStep2 > 0) { this.currentStep2--; }
  }

  getQuantityErrorMessage(control: AbstractControl): string {
    if (control?.hasError('required')) return 'Quantity is required.';
    if (control?.hasError('pattern')) return 'Please enter a valid whole number.';
    return 'Invalid quantity.';
  }

  totalQuantityValidator() {
    return (formArray: FormArray) => {
      const total = formArray.controls.reduce((sum: number, control: AbstractControl) => {
        const qty = control.get('quantity')?.value;
        return sum + (qty ? +qty : 0);
      }, 0);

      // This now compares against the value set in calculateTotal()
      return total <= this.totalHologramLabels ? null : { exceedsAvailable: true };
    };
  }
  asFormGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }

  private groupByMonth(data: MonthlyQuota[]): GroupedQuota[] {
    const grouped: { [key: number]: GroupedQuota } = {};
    data.forEach(item => {
      if (!grouped[item.MonthId]) {
        grouped[item.MonthId] = { monthName: item.MonthName, spirit: 0, malt: 0 };
      }
      if (item.EALType === 'SPIRIT') { grouped[item.MonthId].spirit = item.Quantity; }
      else if (item.EALType === 'MALT') { grouped[item.MonthId].malt = item.Quantity; }
    });
    return Object.values(grouped);
  }

  private calculateTotals(): void {
    const count = this.quotas.length;
    this.totalSpirit = this.quotas.reduce((sum, q) => sum + q.spirit, 0);
    this.totalMalt = this.quotas.reduce((sum, q) => sum + q.malt, 0);
    this.averageSpirit = count ? Math.round(this.totalSpirit / count) : 0;
    this.averageMalt = count ? Math.round(this.totalMalt / count) : 0;
  }

  onFileChange(event: any) {
    if (event.target.files.length > 0) {
      const file = event.target.files[0];
      this.step1Form.patchValue({ photo: file.name });
      const reader = new FileReader();
      reader.onload = () => { this.imagePreview = reader.result; };
      reader.readAsDataURL(file);
    }
  }

  loadDesignations() {
    this.applicationFormService.getDesignations().subscribe({
      next: (data: any[]) => {
        const uniqueList: string[] = data.map(item => item.Designation);
        this.designations = Array.from(new Set(uniqueList));
      },
      error: (err) => console.error('Error fetching designations', err)
    });
  }

  resetForm() {
    this.applicationForm.reset();
    this.challanArray.clear();
    this.quantities.clear();
    this.totalChallanAmount = 0;
    this.totalHologramLabels = 0;
    this.totalEnteredQuantity = 0;
    this.selectedEALTypes.clear();
    this.currentStep2 = 0;
    this.loadSupplierDetails();
  }
}