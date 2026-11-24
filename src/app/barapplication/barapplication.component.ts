import { Component, OnInit } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../services/stock.service';
import { ToastService } from '../services/toast.service';
import { OfficeService } from '../services/office.service';
import { Router } from '@angular/router';
import { ApplicationformService } from '../services/applicationform.service';
import { PdfSignService } from '../services/pdf-sign.service';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { NumberToWordsPipe } from '../number-to-words.pipe';

(pdfMake as any).vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : (pdfFonts as any).vfs;

@Component({
  selector: 'app-barapplication',
  standalone: true,
  imports: [SidebarComponent, CommonModule, FormsModule],
  templateUrl: './barapplication.component.html',
  styleUrl: './barapplication.component.css',
  providers: [DatePipe, NumberToWordsPipe]
})
export class BarapplicationComponent implements OnInit {
  financialYears: string[] = [];
  currentFinancialYear: string = '';
  allMonths: any[] = [];
  stockEntryData: any[] = [];
  applications: any[] = [];
  selectedApplication = {};
  pageSize: number = 2;
  totalPages: number[] = [];

  filters: any = {
    FinancialYear: null,
    Month: null,
    DateFrom: null,
    DateTo: null,
    userType: 'HB',
    EALType: null,
    Search: null,
    Status: 1
  };

  availableLiquorQuantity: any = {
    'SPIRIT': 0,
    'MALT': 0,
    'PLAIN': 0,
    'MASALA': 0,
    'HOTEL/BAR': 0
  };

  ealTypes: any[] = [];
  allStatus: any[] = [];
  loader: boolean = false;

  userTypeList = [
    { id: 'CL', name: 'Country Liquor' },
    { id: 'FL', name: 'Foreign Liquor' },
    { id: 'HB', name: 'HOTEL/BAR' },
  ];
  selectedUserType = this.filters.userType;

  constructor(
    private stockService: StockService,
    private toastService: ToastService,
    private Officeservice: OfficeService,
    private route: Router,
    private applicationFormService: ApplicationformService,
    private datePipe: DatePipe,
    private numberToWordsPipe: NumberToWordsPipe,
    private pdfSignService: PdfSignService
  ) { }

  ngOnInit(): void {
    this.loadStatusMasters();
    this.loadEalTypes();
    this.fillFinancialYears();
    this.loadAllMonths();
    this.fetchAllApplications(1);
    this.loadLiquorQuantity();
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
      error: (error) => console.error('Error fetching quantities:', error)
    });
  }

  loadEalTypes(): void {
    this.stockService.ealtypes().subscribe({
      next: (eals) => this.ealTypes = eals,
      error: (err) => console.error('Error eal types:', err)
    });
  }

  loadStatusMasters(): void {
    this.applicationFormService.getStatusMasters().subscribe({
      next: (response) => this.allStatus = response,
      error: (err) => console.error('Error status masters:', err)
    });
  }

  // ✅ Status wise strict filtering (Completed vs Issued)[cite: 7]
  fetchAllApplications(status: any): void {
    this.loader = true;
    this.applications = [];
    this.filters['Status'] = Number(status);
    this.selectedUserType = this.filters.userType;

    const payload = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value != null)
    );

    if (Number(status) === 14 || Number(status) === 6) {
      payload['Status'] = 6; // Background se status 6 fetch karein taaki client-side filter ho sake
    }

    this.Officeservice.getAllApplications(payload).subscribe({
      next: (data) => {
        const fullList = this.groupDataByDetailId(data);

        if (Number(status) === 14) {
          // Issued Tab: Sirf wahi aayengi jinka status database me 14 hai ya signed hain
          this.applications = fullList.filter(app => Number(app.Status) === 14 || app.IsDscSigned === true || app.IsDscSigned === 1);
        } else if (Number(status) === 6) {
          // Completed Tab: Sirf wahi jo 6 hain aur abhi sign nahi hui hain
          this.applications = fullList.filter(app => Number(app.Status) === 6 && !(app.IsDscSigned === true || app.IsDscSigned === 1));
        } else {
          this.applications = fullList.filter(app => Number(app.Status) === Number(status));
        }

        this.loader = false;
      },
      error: (error) => {
        this.applications = [];
        console.error('Error fetching applications', error);
        this.loader = false;
      }
    });
  }

  groupDataByDetailId(data: any[]): any[] {
    return (data || []).map(app => {
      const groupedData = { req_hotel_bar_qty: 0 };
      (app.ApplicationDetails || []).forEach((detail: any) => {
        groupedData.req_hotel_bar_qty += 
          Number(detail.req_hotel_bar_qty || 0) + 
          Number(detail.req_fl_spirit_qty || 0) + 
          Number(detail.req_fl_malt_qty || 0);
      });

      return { ...app, groupedData };
    });
  }

  onActionClick(selectedApplicationValue: any) {
    let demandDataObject: any[] = [];
    let demandDataObjectViewMode: any[] = [];

    if (selectedApplicationValue.ApplicationDetails) {
      selectedApplicationValue.ApplicationDetails.forEach((d: any) => {
        const typeMapping: { [key: string]: string } = {
          '1': 'req_fl_spirit_qty',
          '2': 'req_fl_malt_qty',
          '3': 'req_cl_plain_qty',
          '4': 'req_cl_masala_qty',
          '5': 'req_hotel_bar_qty'
        };

        const matchedType = this.ealTypes.find(t => t.Id == d.EALType);
        if (matchedType && typeMapping[d.EALType]) {
          demandDataObject.push({
            type: `${matchedType.Type} (${matchedType.Code})`,
            qty: `${d[typeMapping[d.EALType]]}`,
            id: `${d.EALType}`,
            detailId: `${d.DetailId}`
          });

          demandDataObjectViewMode.push({
            type: `${matchedType.Type} (${matchedType.Code})`,
            qty: `${d[typeMapping[d.EALType]] || 0}`,
            id: `${d.EALType}`,
            detailId: `${d.DetailId}`,
            assignedQuantity: d.Approve_hotel_bar_qty || d.Approve_fl_spirit_qty || 0
          });
        }
      });
    }

    const updatedApplicationValue = {
      ...selectedApplicationValue,
      DemandDataObject: demandDataObject,
      DemandDataObjectViewMode: demandDataObjectViewMode,
      StatusName: this.allStatus.find(t => t.Status_Id == selectedApplicationValue.Status)
    };

    this.Officeservice.setSelectedOfficeSupplierApplication(updatedApplicationValue);
    this.route.navigate(['/office-application', selectedApplicationValue['AppId']]);
  }

  buildFullApplicationDocDefinition(data: any): any {
    const formattedDate = this.datePipe.transform(data.CreateDate || new Date(), 'dd-MM-yyyy') || '21-08-2026';
    const permitNumber = data.IssuePermitNo || data.Issue_Permit_No || data.PermitNo || 'CL/FL/HR/HB';

    const rawPos = data.EALPurchaseOrderFLs || data.EALPurchaseOrderCLs || data.PurchaseOrders || [];
    let selectedPO = rawPos[0];

    const poRows: any[] = [
      [
        { text: 'PO Date', bold: true, style: 'tableHeader' },
        { text: 'PO Number', bold: true, style: 'tableHeader' },
        { text: 'Quantity', bold: true, style: 'tableHeader' },
        { text: 'Amount', bold: true, style: 'tableHeader' },
        { text: 'Remaining Qty', bold: true, style: 'tableHeader' },
        { text: 'Valid Upto', bold: true, style: 'tableHeader' },
        { text: 'Status', bold: true, style: 'tableHeader' }
      ],
      [
        { text: this.datePipe.transform(selectedPO?.PODate, 'dd/MM/yyyy') || '-', style: 'smallText' },
        { text: selectedPO?.PurchaseOrderNo || '-', bold: true, style: 'smallText' },
        { text: String(selectedPO?.TotalQty || selectedPO?.Quantity || 0), style: 'smallText' },
        { text: `Rs. ${Number(selectedPO?.POAmount || 0).toLocaleString('en-IN')}`, style: 'smallText' },
        { text: String(selectedPO?.RemainingQty || '-'), style: 'smallText' },
        { text: this.datePipe.transform(selectedPO?.ValidUpto, 'dd/MM/yyyy') || '-', style: 'smallText' },
        { text: selectedPO?.Status || 'Pending', style: 'smallText' }
      ]
    ];

    const rawChallans = data.EALChallanFLs || data.EALChallanCLs || [];
    let selectedChallan = rawChallans[0];

    const challanRows: any[] = [
      [
        { text: 'Challan Date', bold: true, style: 'tableHeader' },
        { text: 'Challan Number', bold: true, style: 'tableHeader' },
        { text: 'Amount', bold: true, style: 'tableHeader' },
        { text: 'Remaining Amount', bold: true, style: 'tableHeader' },
        { text: 'Status', bold: true, style: 'tableHeader' }
      ],
      [
        { text: this.datePipe.transform(selectedChallan?.ChallanDate, 'dd/MM/yyyy') || '-', style: 'smallText' },
        { text: selectedChallan?.ChallanNo || '-', bold: true, style: 'smallText' },
        { text: `Rs. ${Number(selectedChallan?.ChallanAmount || 0).toLocaleString('en-IN')}`, style: 'smallText' },
        { text: `Rs. ${Number(selectedChallan?.RemainingAmount || 0).toLocaleString('en-IN')}`, style: 'smallText' },
        { text: selectedChallan?.Status || 'Partially', style: 'smallText' }
      ]
    ];

    return {
      pageSize: 'A4',
      pageMargins: [20, 15, 20, 15],
      content: [
        { text: 'CHHATTISGARH STATE EXCISE DEPARTMENT', style: 'mainHeader', alignment: 'center' },
        { text: 'Excise Adhesive Labels Application & Verification Summary (Hotel/Bar)', style: 'subHeader', alignment: 'center', margin: [0, 1, 0, 6] },
        {
          table: {
            widths: ['35%', '35%', '30%'],
            body: [
              [
                { text: `Application No: ${data.EalApplicationNo || '-'}`, bold: true, fontSize: 8.5 },
                { text: `Permit No: ${permitNumber}`, bold: true, fontSize: 8.5, alignment: 'center', color: '#dc2626' },
                { text: `Date: ${formattedDate}`, bold: true, fontSize: 8.5, alignment: 'right' }
              ]
            ]
          },
          layout: { hLineWidth: () => 0.8, vLineWidth: () => 0.8, hLineColor: () => '#93c5fd', vLineColor: () => '#93c5fd' },
          margin: [0, 0, 0, 6]
        },
        { text: 'Purchase Orders', color: '#2563eb', bold: true, fontSize: 9, margin: [0, 2, 0, 2] },
        {
          table: { widths: ['14%', '24%', '10%', '18%', '14%', '11%', '9%'], body: poRows },
          layout: { hLineColor: () => '#bfdbfe', vLineColor: () => '#bfdbfe', hLineWidth: () => 0.6, vLineWidth: () => 0.6 },
          margin: [0, 0, 0, 6]
        },
        { text: 'Challan Details', color: '#2563eb', bold: true, fontSize: 9, margin: [0, 2, 0, 2] },
        {
          table: { widths: ['18%', '28%', '18%', '22%', '14%'], body: challanRows },
          layout: { hLineColor: () => '#bfdbfe', vLineColor: () => '#bfdbfe', hLineWidth: () => 0.6, vLineWidth: () => 0.6 },
          margin: [0, 0, 0, 6]
        },
        {
          columns: [
            { text: '', width: '*' },
            {
              stack: [
                { text: 'Authorised Signatory', bold: true, fontSize: 9.5, alignment: 'right' },
                { text: 'Office of The Excise Commissioner', fontSize: 8.5, alignment: 'right' },
                { text: 'Chhattisgarh, Sector 19, Nava Raipur', fontSize: 8.5, alignment: 'right' }
              ]
            }
          ],
          margin: [0, 10, 0, 0]
        }
      ],
      styles: {
        mainHeader: { fontSize: 11.5, bold: true, color: '#0f172a' },
        subHeader: { fontSize: 8.5, color: '#334155' },
        tableHeader: { fontSize: 7.5, bold: true, fillColor: '#dbeafe', color: '#1e3a8a', alignment: 'center' },
        smallText: { fontSize: 7.5, color: '#1e293b' }
      },
      defaultStyle: { fontSize: 7.8, color: '#1e293b' }
    };
  }

  previewPermit(app: any): void {
    const docDef = this.buildFullApplicationDocDefinition(app);
    if (app.IsDscSigned || app.Status == 14 || (app.IssuePermitNo && app.IssuePermitNo !== '-')) {
      pdfMake.createPdf(docDef).getBlob((pdfBlob: Blob) => {
        const pdfFile = new File([pdfBlob], `Permit_${app.AppId}.pdf`, { type: 'application/pdf' });
        const signer = app.SignedBy || app.SignerName || 'SATPAL SINGH BHATIA';
        (this.pdfSignService as any).signPdf(pdfFile, 'Pass@123', signer).subscribe({
          next: (signedBlob: Blob) => window.open(window.URL.createObjectURL(signedBlob), '_blank'),
          error: () => pdfMake.createPdf(docDef).open()
        });
      });
    } else {
      pdfMake.createPdf(docDef).open();
    }
  }

  printPermit(app: any): void {
    const docDef = this.buildFullApplicationDocDefinition(app);
    pdfMake.createPdf(docDef).getBlob((pdfBlob: Blob) => {
      const pdfFile = new File([pdfBlob], `Permit_${app.AppId}.pdf`, { type: 'application/pdf' });
      const signer = app.SignedBy || app.SignerName || 'SATPAL SINGH BHATIA';
      (this.pdfSignService as any).signPdf(pdfFile, 'Pass@123', signer).subscribe({
        next: (signedBlob: Blob) => {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = window.URL.createObjectURL(signedBlob);
          document.body.appendChild(iframe);
          iframe.onload = () => { iframe.contentWindow?.print(); };
        },
        error: () => pdfMake.createPdf(docDef).print()
      });
    });
  }

  downloadPermit(app: any): void {
    const docDef = this.buildFullApplicationDocDefinition(app);
    pdfMake.createPdf(docDef).getBlob((pdfBlob: Blob) => {
      const pdfFile = new File([pdfBlob], `Permit_${app.AppId}.pdf`, { type: 'application/pdf' });
      const signer = app.SignedBy || app.SignerName || 'SATPAL SINGH BHATIA';
      (this.pdfSignService as any).signPdf(pdfFile, 'Pass@123', signer).subscribe({
        next: (signedBlob:Blob) => {
          const url = window.URL.createObjectURL(signedBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Signed_Permit_${app.EalApplicationNo ? app.EalApplicationNo.replace(/\//g, '_') : app.AppId}.pdf`;
          link.click();
        },
        error: () => pdfMake.createPdf(docDef).download(`Permit_${app.EalApplicationNo || app.AppId}.pdf`)
      });
    });
  }

  fillFinancialYears(): void {
    const cur = new Date().getFullYear();
    const m = new Date().getMonth();
    const yr = m < 3 ? cur - 1 : cur;
    this.currentFinancialYear = `${yr}-${yr + 1}`;
    this.filters.FinancialYear = this.currentFinancialYear;
  }

  loadAllMonths(): void {
    this.stockService.getAllMonths().subscribe({
      next: (m) => this.allMonths = m,
      error: (e) => console.error('Months error:', e)
    });
  }

  resetFilters() {
    this.filters = {
      FinancialYear: this.currentFinancialYear,
      Month: null,
      DateFrom: null,
      DateTo: null,
      userType: 'HB',
      Status: 1,
      EALType: null,
      Search: null
    };
    this.fetchAllApplications(1);
  }
}