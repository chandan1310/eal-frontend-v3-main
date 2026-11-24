import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StockService } from '../services/stock.service';
import { ToastService } from '../services/toast.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-verify-auth-persons',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FormsModule],
  templateUrl: './verify-auth-persons.component.html',
  styleUrl: './verify-auth-persons.component.css'
})
export class VerifyAuthPersonsComponent implements OnInit {
  pendingList: any[] = [];
  groupedByCompany: { [key: string]: any[] } = {};

  isSupplierModalOpen: boolean = false;
  selectedSupplierName: string = '';
  selectedSupplierRequests: any[] = [];

  constructor(
    private stockService: StockService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadPendingList();
  }

  loadPendingList() {
    this.stockService.getPendingAuthPersons().subscribe({
      next: (data) => {
        const rawList = data || [];
        // Filter out duplicate entries based on AuthPersonId to prevent repeating 3 times
        this.pendingList = rawList.filter((item, index, self) =>
          index === self.findIndex(t => t.AuthPersonId === item.AuthPersonId)
        );

        this.groupDataByCompany();
        
        if (this.isSupplierModalOpen && this.selectedSupplierName) {
          this.selectedSupplierRequests = this.groupedByCompany[this.selectedSupplierName] || [];
          if (this.selectedSupplierRequests.length === 0) {
            this.closeSupplierModal();
          }
        }
      },
      error: (err) => {
        console.error('Error loading pending list', err);
      }
    });
  }

  groupDataByCompany() {
    this.groupedByCompany = {};
    this.pendingList.forEach(item => {
      const companyKey = item.SupplierName || 'Unknown Supplier';
      if (!this.groupedByCompany[companyKey]) {
        this.groupedByCompany[companyKey] = [];
      }
      this.groupedByCompany[companyKey].push(item);
    });
  }

  getCompanyKeys(): string[] {
    return Object.keys(this.groupedByCompany);
  }

  openSupplierModal(companyKey: string) {
    this.selectedSupplierName = companyKey;
    this.selectedSupplierRequests = this.groupedByCompany[companyKey] || [];
    this.isSupplierModalOpen = true;
  }

  closeSupplierModal() {
    this.isSupplierModalOpen = false;
    this.selectedSupplierName = '';
    this.selectedSupplierRequests = [];
  }

  getFileUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const baseDomain = environment.fileBaseUrl || '';
    return `${baseDomain}${path}`;
  }

  verifyRecord(id: number, status: number) {
    const actionText = status === 1 ? 'approve' : 'reject';
    if (confirm(`Are you sure you want to ${actionText} this authorized person?`)) {
      this.stockService.verifyAuthPerson(id, status).subscribe({
        next: () => {
          this.toastService.show(`Record ${status === 1 ? 'approved' : 'rejected'} successfully!`, { class: 'success' });
          this.loadPendingList();
        },
        error: (err) => {
          this.toastService.show(err.error?.message || 'Action failed!', { class: 'danger' });
        }
      });
    }
  }
}
// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { StockService } from '../services/stock.service';
// import { ToastService } from '../services/toast.service';
// import { SidebarComponent } from '../sidebar/sidebar.component';
// import { FormsModule } from '@angular/forms';

// @Component({
//   selector: 'app-verify-auth-persons',
//   standalone: true,
//   imports: [CommonModule, SidebarComponent, FormsModule],
//   templateUrl: './verify-auth-persons.component.html',
//   styleUrl: './verify-auth-persons.component.css'
// })
// export class VerifyAuthPersonsComponent implements OnInit {
//   pendingList: any[] = [];
//   groupedByCompany: { [key: string]: any[] } = {};

//   isSupplierModalOpen: boolean = false;
//   selectedSupplierName: string = '';
//   selectedSupplierRequests: any[] = [];

//   // Updated to match your .NET backend port (5082)
//   private baseUrl = 'http://localhost:5082';

//   constructor(
//     private stockService: StockService,
//     private toastService: ToastService
//   ) {}

//   ngOnInit(): void {
//     this.loadPendingList();
//   }

//   loadPendingList() {
//     this.stockService.getPendingAuthPersons().subscribe({
//       next: (data) => {
//         const rawList = data || [];
//         // Filter out duplicate entries based on AuthPersonId to prevent repeating 3 times
//         this.pendingList = rawList.filter((item, index, self) =>
//           index === self.findIndex(t => t.AuthPersonId === item.AuthPersonId)
//         );

//         this.groupDataByCompany();
        
//         if (this.isSupplierModalOpen && this.selectedSupplierName) {
//           this.selectedSupplierRequests = this.groupedByCompany[this.selectedSupplierName] || [];
//           if (this.selectedSupplierRequests.length === 0) {
//             this.closeSupplierModal();
//           }
//         }
//       },
//       error: (err) => {
//         console.error('Error loading pending list', err);
//       }
//     });
//   }

//   groupDataByCompany() {
//     this.groupedByCompany = {};
//     this.pendingList.forEach(item => {
//       const companyKey = item.SupplierName || 'Unknown Supplier';
//       if (!this.groupedByCompany[companyKey]) {
//         this.groupedByCompany[companyKey] = [];
//       }
//       this.groupedByCompany[companyKey].push(item);
//     });
//   }

//   getCompanyKeys(): string[] {
//     return Object.keys(this.groupedByCompany);
//   }

//   openSupplierModal(companyKey: string) {
//     this.selectedSupplierName = companyKey;
//     this.selectedSupplierRequests = this.groupedByCompany[companyKey] || [];
//     this.isSupplierModalOpen = true;
//   }

//   closeSupplierModal() {
//     this.isSupplierModalOpen = false;
//     this.selectedSupplierName = '';
//     this.selectedSupplierRequests = [];
//   }

//   getFileUrl(path: string): string {
//     if (!path) return '';
//     if (path.startsWith('http://') || path.startsWith('https://')) {
//       return path;
//     }
//     return `${this.baseUrl}${path}`;
//   }

//   verifyRecord(id: number, status: number) {
//     const actionText = status === 1 ? 'approve' : 'reject';
//     if (confirm(`Are you sure you want to ${actionText} this authorized person?`)) {
//       this.stockService.verifyAuthPerson(id, status).subscribe({
//         next: () => {
//           this.toastService.show(`Record ${status === 1 ? 'approved' : 'rejected'} successfully!`, { class: 'success' });
//           this.loadPendingList();
//         },
//         error: (err) => {
//           this.toastService.show(err.error?.message || 'Action failed!', { class: 'danger' });
//         }
//       });
//     }
//   }
// }