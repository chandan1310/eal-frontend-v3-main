import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { OfficeService } from '../services/office.service';

@Component({
    selector: 'app-destroy-lable',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './destroy-label.component.html',
    styleUrls: ['./destroy-label.component.css']
})
export class DestroyLabelComponent implements OnInit {
  destroyEntries: any[] = [];
  loading = false;
  errorMessage = '';

  wastageIdFilter: string = '';
  boxNoFilter: string = '';

  selectedEntry: any = null;
  panchnamaFile: File | null = null;
  videoFile: File | null = null;

  constructor(private officeService: OfficeService) { }

  ngOnInit(): void {
    this.loadDestroyMaster();
  }

  loadDestroyMaster(): void {
    this.loading = true;
    this.errorMessage = '';

    const filters: any = {};
    if (this.wastageIdFilter) filters.wastageId = this.wastageIdFilter;
    if (this.boxNoFilter) filters.boxNo = this.boxNoFilter;

    this.officeService.getDestroyMaster(Object.keys(filters).length > 0 ? filters : undefined)
      .subscribe({
        next: (data: any[]) => {
          this.destroyEntries = data.map(entry => ({
            ...entry,
            totalDamage: entry.DamageEnd && entry.DamageStart
              ? (entry.DamageEnd - entry.DamageStart + 1)
              : 0
          }));
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = 'Failed to load Destroy Master records';
          console.error(err);
          this.loading = false;
        }
      });
  }

  resetFilters(): void {
    this.wastageIdFilter = '';
    this.boxNoFilter = '';
    this.loadDestroyMaster();
  }

  editEntry(entry: any): void {
    this.selectedEntry = { 
      ...entry,
      name: entry.OfficerName || '', 
      designation: entry.Designation || ''
    };
  }

  cancelEdit(): void {
    this.selectedEntry = null;
    this.panchnamaFile = null;
    this.videoFile = null;
  }

  onPanchnamaUpload(event: any): void {
    const file = event.target.files[0];
    if (file) this.panchnamaFile = file;
  }

  onVideoUpload(event: any): void {
    const file = event.target.files[0];
    if (file) this.videoFile = file;
  }

  saveEntry(): void {
    if (!this.selectedEntry) {
      alert('No entry selected to save!');
      return;
    }

    const formData = new FormData();

    const extractString = (key: string): string => {
      if (this.selectedEntry[key] !== undefined && this.selectedEntry[key] !== null) {
        return String(this.selectedEntry[key]).trim();
      }
      const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
      if (this.selectedEntry[lowerKey] !== undefined && this.selectedEntry[lowerKey] !== null) {
        return String(this.selectedEntry[lowerKey]).trim();
      }
      return '';
    };

    // 1. CRITICAL: Append unique keys for targeted identification & delete operations
    const wastageIdVal = this.selectedEntry.WastageId || this.selectedEntry.wastageId || '';
    formData.append('WastageId', String(wastageIdVal));

    const boxIdVal = this.selectedEntry.BoxId || this.selectedEntry.boxId || this.selectedEntry.boxid || '0';
    formData.append('BoxId', String(boxIdVal));

    // 2. Append standard mapping attributes
    formData.append('BoxNo', extractString('BoxNo'));
    formData.append('AppId', extractString('AppId') || '0');
    formData.append('LiquorType', extractString('LiquorType'));
    formData.append('LiquorName', extractString('LiquorName'));
    formData.append('CompanyName', extractString('CompanyName'));
    formData.append('CompanyAddress', extractString('CompanyAddress'));
    formData.append('DamageStart', extractString('DamageStart') || '0');
    formData.append('DamageEnd', extractString('DamageEnd') || '0');
    formData.append('FinancialYear', extractString('FinancialYear'));
    
    const monthIdVal = this.selectedEntry.Month_Id || this.selectedEntry.month_Id || '1';
    formData.append('Month_Id', String(monthIdVal));
    
    formData.append('Name', extractString('name')); 
    formData.append('Designation', extractString('designation'));

    if (this.panchnamaFile) {
      formData.append('Panchnama', this.panchnamaFile, this.panchnamaFile.name);
    }
    if (this.videoFile) {
      formData.append('Video', this.videoFile, this.videoFile.name);
    }

    this.loading = true;
    this.officeService.createDestroyMaster(formData).subscribe({
      next: (response) => {
        alert('Record created and processed successfully!');
        this.selectedEntry = null;
        this.panchnamaFile = null;
        this.videoFile = null;
        this.loadDestroyMaster(); // Relational queue clean refresh
      },
      error: (err) => {
        console.error("Server execution error details: ", err);
        alert('Failed to create destroy master record');
        this.loading = false;
      }
    });
  }
}