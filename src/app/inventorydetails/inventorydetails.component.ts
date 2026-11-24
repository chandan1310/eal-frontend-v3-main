import { SidebarComponent } from '../sidebar/sidebar.component';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../services/stock.service';
import { ToastService } from '../services/toast.service';
import { OfficeService } from '../services/office.service';
import { GlobalService } from '../services/global.service';


@Component({
    selector: 'app-inventorydetails',
    standalone: true,
    imports: [SidebarComponent, CommonModule, FormsModule],
    templateUrl: './inventorydetails.component.html',
    styleUrl: './inventorydetails.component.css'
})
export class InventorydetailsComponent implements OnInit {
  financialYears: string[] = [];
  currentFinancialYear: string = ''; // Variable to store the current financial year
  allMonths: any[] = [];
  ealTypes: any[] = [];
  stockEntryData: any[] = [];
  globalIndex = 0;

  selectedBoxNo: string | null = null;
  placeFromList: any[] = [];
  // boxNoList: string[] = [];

  filters = {
    financialYear: null,
    month: null,
    ealTypeId: null,
    stockStatus: null,
    boxId: null,
  };

  availableLiquorQuantity: any = {
    'SPIRIT': 0,
    'MALT': 0,
    'PLAIN': 0,
    'MASALA': 0,
    'HOTEL/BAR': 0
  };

  purchaseDetails: any = {};
  tempStockData: any[] = [];

  constructor(
    private stockService: StockService,
    private toastService: ToastService, private Officeservice: OfficeService, public gs: GlobalService
  ) { }

  ngOnInit(): void {
    this.fillFinancialYears();
    this.loadAllMonths();
    this.loadEalTypes();
    this.getStockEntries();
    this.loadLiquorQuantity();
    this.loadPlaceFrom();
    this.loadPlaceFromAndEntries(); // chained
  }


  loadPlaceFromAndEntries(): void {
    this.stockService.placefrom().subscribe({
      next: (places) => {
        this.placeFromList = places || [];
        // console.log('placeFromList loaded:', this.placeFromList);
        this.getStockEntries(); // now safe to call
      },
      error: (error) => {
        // console.error('Error fetching places:', error);
        this.placeFromList = [];
        this.getStockEntries(); // still fetch entries to show table
      },
    });
  }


  // Function to calculate and fill the financial years (current and previous)
  fillFinancialYears(): void {
    const currentDate = new Date();
    let currentYear = currentDate.getFullYear();
    const month = currentDate.getMonth(); // Get the current month (0 = January, 11 = December)

    // If the current month is before April, the financial year will be in the previous year
    if (month < 3) {
      // March is month 2, so before April is less than 3
      currentYear--;
    }

    this.currentFinancialYear = `${currentYear}-${currentYear + 1}`; // Format the financial year

    this.filters.financialYear = this.currentFinancialYear;
  }

  loadAllMonths(): void {
    this.stockService.getAllMonths().subscribe({
      next: (months) => {
        this.allMonths = months;
      },
      error: (error) => {
        console.error('Error fetching months:', error);
      },
    });
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



  getStockEntries() {
    const payload = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value != null)
    );
    this.gs.searchText = '';

    this.stockService.getStockEntriesDetails(payload).subscribe({
      next: (response: any) => {
        console.log('Stock entries raw response:', response);
        const data = Array.isArray(response?.Data) ? response.Data : [];
        // Map and normalize
        this.stockEntryData = data.map((item: any) => {
          (item?.Entries || []).forEach((entry: any) => {
            // from place name
            entry.fromPlaceName =
              this.placeFromList.find(p => p.Place_Id == entry.from)?.Place_Name || '';

            // normalize helpers
            entry.ealLatestCode = this.normalizeToText(entry.ealLatestCode);
            entry.StartNo = this.normalizeToText(entry.StartNo);
            entry.EndNo = this.normalizeToText(entry.EndNo);
            entry.ealTypeValue = this.normalizeToText(entry.ealTypeValue);
            entry.ealTypeCode = this.normalizeToText(entry.ealTypeCode);
          });
          return item;
        });

        this.tempStockData = [...this.stockEntryData];
        this.setupPagination();
      },
      error: (error) => {
        this.toastService.show('Something went Wrong!', { class: 'danger' });
      },
    });
  }

  // Put this helper below your class methods (still inside class)
  private normalizeToText(value: any): string | number {
    // if primitive, keep as is
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return value;
    // if object or array, try common fields first
    if (typeof value === 'object') {
      // try common properties (adapt if your API uses different keys)
      const candidates = ['value', 'val', 'code', 'num', 'id', 'text', 'name'];
      for (const key of candidates) {
        if (value[key] !== undefined && (typeof value[key] === 'string' || typeof value[key] === 'number')) {
          return value[key];
        }
      }
      // fallback: flatten all primitive values
      const flat = Object.values(value).filter(v => ['string', 'number'].includes(typeof v));
      return flat.length ? flat.join('') : JSON.stringify(value);
    }
    return String(value);
  }


  getGlobalIndex(entryIndex: number, boxIndex: number): number {
    return boxIndex * 9 + entryIndex + 1; // 1-based index
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
      error: (error) => {
        console.error('Error fetching months:', error);
      },
    });
  }

  loadPlaceFrom(): void {
    this.stockService.placefrom().subscribe({
      next: (places) => {
        this.placeFromList = places;
      },
      error: (error) => {
        console.error('Error fetching places:', error);
      },
    });
  }

  resetFilters() {
    this.filters = {
      financialYear: this.currentFinancialYear,   // keep the current FY after Reset
      month: null,
      ealTypeId: null,
      stockStatus: null,
      boxId: null,
    };
    this.gs.searchText = '';
    this.getStockEntries();
  }

  openAssignModal(spoolId: any, AppId: any) {
    $('#purchaseOrderModal').modal('show');
    let payload = {
      "AppId": AppId,
      "SpoolId": spoolId
    }
    this.Officeservice.getSpoolAssignmentDetailsAPI(payload).subscribe({
      next: (response: any) => {
        const liquorTypes = {
          '1': { type: 'FOREIGN LIQUOR - SPIRIT', reqKey: 'ReqFlSpiritQty', approveKey: 'ApproveFlSpiritQty' },
          '2': { type: 'FOREIGN LIQUOR - MALT', reqKey: 'ReqFlMaltQty', approveKey: 'ApproveFlMaltQty' },
          '3': { type: 'COUNTRY LIQUOR - PLAIN', reqKey: 'ReqClPlainQty', approveKey: 'ApproveClPlainQty' },
          '4': { type: 'COUNTRY LIQUOR - MASALA', reqKey: 'ReqClMasalaQty', approveKey: 'ApproveClMasalaQty' },
          '5': { type: 'Hotel/Bar', reqKey: 'ReqHotelBarQty', approveKey: 'ApproveHotelBarQty' }
        };

        let demand = response['ApplicationDetails'].map((detail) => {
          const liquor = liquorTypes[detail.EALType];
          return liquor ? {
            type: liquor.type,
            reqQty: detail[liquor.reqKey],
            approveQty: detail[liquor.approveKey]
          } : null;
        }).filter(item => item !== null);

        response['demand'] = demand;

        this.purchaseDetails = response;
        // console.log('this.purchaseDetails', this.purchaseDetails);
      },
      error: (error) => {
        let errorMessage = 'Something went Wrong!';
        this.toastService.show(errorMessage, { class: 'danger' });
      },
    });
  }

  purchaseOrderModalAction() {
    this.purchaseDetails = {};
    $('#purchaseOrderModal').modal('hide');
  }

  printPurchaseDetails() {
    const printContents = document.getElementById('printSection');

    if (!printContents) {
      console.error('No print content found');
      return;
    }

    const WindowPrt = window.open('', '_blank', 'width=900,height=650');
    if (!WindowPrt) {
      alert('Pop-up blocked! Please allow pop-ups for this site.');
      return;
    }

    WindowPrt.document.open();
    WindowPrt.document.write(`
      <html>
        <head>
          <title>Print Purchase Details</title>
          <style>
            body { font-family: Arial; padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; border: 1px solid #ccc; vertical-align: top; }
            h2 { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h2>Purchase Details</h2>
          ${printContents.innerHTML}
        </body>
      </html>
    `);
    WindowPrt.document.close();

    // Slight delay ensures styles load
    setTimeout(() => {
      WindowPrt.focus();
      WindowPrt.print();
      WindowPrt.close();
    }, 500);
  }



  // Define component vars
  paginatedData: any[] = [];  // data shown on current page
  currentPage: number = 1;
  itemsPerPage: number = 2;
  totalPages: number[] = [];

  setupPagination() {
    const totalItems = this.stockEntryData.length;
    const pages = Math.ceil(totalItems / this.itemsPerPage);
    this.totalPages = Array(pages)
      .fill(0)
      .map((_, i) => i + 1);
    this.updatePaginatedData();
  }

  updatePaginatedData() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.paginatedData = this.stockEntryData.slice(start, end);

    this.paginatedData.forEach((box) => {
      (box.Entries || []).forEach((entry) => {
        // Logic can be added here if needed for processing each entry
      });
    });
  }


  goToPage(page: number) {
    this.currentPage = page;
    this.updatePaginatedData();
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedData();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages.length) {
      this.currentPage++;
      this.updatePaginatedData();
    }
  }

  searchProduct(searchTax: any) {
    console.log('Search', this.gs.manageSearchData(this.tempStockData, searchTax || ''))
    this.stockEntryData = this.gs.manageSearchData(this.tempStockData, searchTax || '');
    this.setupPagination();
  }
}
