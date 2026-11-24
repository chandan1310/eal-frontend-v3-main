import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { StockService } from '../services/stock.service';
import { ToastService } from '../services/toast.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-create-auth-person',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, SidebarComponent],
  templateUrl: './create-auth-person.component.html'
})
export class CreateAuthPersonComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('idFileInput') idFileInput!: ElementRef;
  @ViewChild('authLetterInput') authLetterInput!: ElementRef;
  @ViewChild('deactivateModal') deactivateModal!: ElementRef;

  authForm!: FormGroup;
  selectedFile: File | null = null;
  selectedIdFile: File | null = null;
  selectedAuthFile: File | null = null;

  designationsList = ['Recipient', 'Authorized', 'Employee'];
  idCardTypesList = ['Voter ID', 'PAN Card', 'Driving License', 'Government ID Card'];
  isSubmitting = false;
  authPersons: any[] = [];
  deactivatedPersons: any[] = [];
  isLimitReached = false;

  // Deactivation Modal Properties
  showDeactivateModal: boolean = false;
  deactivationRemark: string = '';
  selectedPersonIdToDeactivate: number | null = null;

  constructor(
    private fb: FormBuilder,
    private stockService: StockService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.authForm = this.fb.group({
      authPersonName: ['', [Validators.required, Validators.pattern('^[a-zA-Z ]*$')]],
      authPersonMobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      authPersonAddress: ['', Validators.required],
      personName: ['', [Validators.required, Validators.pattern('^[a-zA-Z ]*$')]],
      designation: ['', Validators.required],
      idCardType: ['', Validators.required],
      idCardFile: [null, Validators.required],
      photo: [null, Validators.required],
      authLetterFile: [null, Validators.required]
    });

    this.loadAuthPersons();
    this.loadDeactivatedPersons();
  }

  loadAuthPersons(): void {
    const supplierId = Number(sessionStorage.getItem('SupplierId') || 0);

    this.stockService.getAuthPersons(supplierId).subscribe({
      next: (data: any[]) => {
        const rawList = data || [];
        this.authPersons = rawList.filter((item, index, self) =>
          index === self.findIndex(t => t.AuthPersonId === item.AuthPersonId)
        );
        this.isLimitReached = this.authPersons.length >= 3;
      },
      error: (err) => console.error(err)
    });
  }

  loadDeactivatedPersons(): void {
    const supplierId = sessionStorage.getItem('SupplierId') || '0';
    this.stockService.getDeactivatedAuthPersons(parseInt(supplierId, 10)).subscribe({
      next: (data: any[]) => {
        const rawList = data || [];
        this.deactivatedPersons = rawList.filter((item, index, self) => {
          return index === self.findIndex(t => t.AuthPersonId === item.AuthPersonId);
        });
      },
      error: (err) => console.error('Error loading deactivated list:', err)
    });
  }

  getFileUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const baseDomain = environment.fileBaseUrl || '';
    return `${baseDomain}${path}`;
  }

  onFileChange(event: any): void {
    if (event.target.files.length > 0) {
      const file = event.target.files[0];
      if (!file.type.startsWith('image/')) {
        this.toastService.show('Only JPG/PNG images are allowed for Person Image!', { class: 'danger' });
        return;
      }
      if (file.size > 1024 * 1024) {
        this.toastService.show('Person Image size cannot exceed 1MB!', { class: 'danger' });
        return;
      }
      this.selectedFile = file;
      this.authForm.patchValue({ photo: file });
      this.authForm.get('photo')?.updateValueAndValidity();
    }
  }

  onIdFileChange(event: any): void {
    if (event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        this.toastService.show('ID Card file size cannot exceed 2MB!', { class: 'danger' });
        return;
      }
      this.selectedIdFile = file;
      this.authForm.patchValue({ idCardFile: file });
      this.authForm.get('idCardFile')?.updateValueAndValidity();
    }
  }

  onAuthLetterChange(event: any): void {
    if (event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        this.toastService.show('Authorization letter file size cannot exceed 2MB!', { class: 'danger' });
        return;
      }
      this.selectedAuthFile = file;
      this.authForm.patchValue({ authLetterFile: file });
      this.authForm.get('authLetterFile')?.updateValueAndValidity();
    }
  }

  onSubmit(): void {
    if (this.isLimitReached) {
      this.toastService.show('Maximum limit of 3 active authorized persons reached!', { class: 'danger' });
      return;
    }

    this.authForm.markAllAsTouched();
    if (this.authForm.invalid || !this.selectedFile || !this.selectedIdFile || !this.selectedAuthFile) return;

    this.isSubmitting = true;
    const formData = new FormData();
    formData.append('SupplierId', sessionStorage.getItem('SupplierId') || '0');
    formData.append('AuthPersonName', this.authForm.get('authPersonName')?.value);
    formData.append('AuthPersonMobile', this.authForm.get('authPersonMobile')?.value);
    formData.append('AuthPersonAddress', this.authForm.get('authPersonAddress')?.value);
    formData.append('PersonName', this.authForm.get('personName')?.value);
    formData.append('Designation', this.authForm.get('designation')?.value);
    formData.append('IdCardType', this.authForm.get('idCardType')?.value);
    formData.append('IdCardFile', this.selectedIdFile);
    formData.append('Photo', this.selectedFile);
    formData.append('AuthLetterFile', this.selectedAuthFile);

    this.stockService.addAuthPerson(formData).subscribe({
      next: () => {
        this.toastService.show('Saved successfully!', { class: 'success' });
        this.resetForm();
        this.loadAuthPersons();
        this.loadDeactivatedPersons();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toastService.show(err.error?.message || 'Save failed!', { class: 'danger' });
      }
    });
  }

  deactivatePerson(id: number): void {
    this.selectedPersonIdToDeactivate = id;
    this.deactivationRemark = '';
    this.showDeactivateModal = true;
  }

  closeDeactivateModal(): void {
    this.showDeactivateModal = false;
    this.selectedPersonIdToDeactivate = null;
    this.deactivationRemark = '';
  }

  confirmDeactivation(): void {
    if (!this.deactivationRemark || !this.deactivationRemark.trim()) {
      this.toastService.show('Deactivation remark is required!', { class: 'danger' });
      return;
    }

    if (this.selectedPersonIdToDeactivate === null) return;

    this.stockService.deactivateAuthPerson(this.selectedPersonIdToDeactivate, this.deactivationRemark.trim()).subscribe({
      next: () => {
        this.toastService.show('Deactivated successfully!', { class: 'success' });
        this.closeDeactivateModal();
        this.loadAuthPersons();
        this.loadDeactivatedPersons();
      },
      error: (err) => {
        this.toastService.show(err.error?.message || 'Deactivation failed!', { class: 'danger' });
      }
    });
  }

  activatePerson(id: number): void {
    if (this.authPersons.length >= 3) {
      this.toastService.show('Maximum limit reached. Cannot activate.', { class: 'danger' });
      return;
    }
    if (confirm('Are you sure you want to activate this record?')) {
      this.stockService.activateAuthPerson(id).subscribe({
        next: () => {
          this.toastService.show('Activated successfully!', { class: 'success' });
          this.loadAuthPersons();
          this.loadDeactivatedPersons();
        },
        error: (err) => this.toastService.show(err.error?.message || 'Activation failed!', { class: 'danger' })
      });
    }
  }

  resetForm(): void {
    this.authForm.reset({ designation: '', idCardType: '' });
    this.selectedFile = null;
    this.selectedIdFile = null;
    this.selectedAuthFile = null;
    this.isSubmitting = false;
    if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
    if (this.idFileInput?.nativeElement) this.idFileInput.nativeElement.value = '';
    if (this.authLetterInput?.nativeElement) this.authLetterInput.nativeElement.value = '';
  }
}