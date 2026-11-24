import { Component } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StockService } from '../services/stock.service';
import * as XLSX from 'xlsx-js-style';
import { ToastService } from '../services/toast.service';

interface StockTransaction {
  date: string;
  dcNo?: string[];
  fromPlace?: string[];
  to?: string;
  permitNo?: string[];
  supplierName?: string;
  count: { PL: number; ML: number; ST: number; BR: number; HB: number; Total: number };
  type: 'inward' | 'outward' | 'ob' | 'cb';
}

@Component({
    selector: 'app-stock-report',
    standalone: true,
    imports: [SidebarComponent, CommonModule, FormsModule],
    templateUrl: './stock-report.component.html',
    styleUrl: './stock-report.component.css'
})
export class StockReportComponent {
  stockInwardData: any[] = [];
  stockOutwardData: any[] = [];
  stockLedgerData: any[] = [];
  placeFromList: any[] = [];

  displayedColumns: string[] = ['date', 'appId', 'company', 'permitNo', 'labels'];
  selectedTab = 'inward';
  loader: boolean = false;
  constructor(private stockService: StockService, private toastService: ToastService) { }

  ngOnInit(): void {
    this.loadPlaceFrom();
    this.loadStockInwardDetails();
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


  loadStockOutwardDetails() {
    this.loader = true;
    this.stockInwardData = [];
    this.stockOutwardData = [];
    this.stockLedgerData = [];
    this.stockService.getStockOutwardDetails().subscribe(
      (data) => {
        this.stockOutwardData = this.transformStockData(data);
        this.loader = false;
      },
      (error) => {
        console.error('Error fetching stock data:', error);
        this.loader = false;
      }
    );
  }

  getLabelTypes(row: any): string[] {
    return Object.keys(row.Labels);
  }

  exportToCSV() {
    if (this.selectedTab === 'outward') {
      this.exportOutwardToCSV();
    } else if (this.selectedTab === 'inward') {
      this.exportInwardToCSV();
    } else {
      this.exportLedgerToCSV();
    }
  }

  exportOutwardToCSV() {
    if (!this.stockOutwardData || this.stockOutwardData.length === 0) {
      this.toastService.show('No data to export!', { class: 'warning' });
      return;
    }

    const ws = XLSX.utils.aoa_to_sheet([]);

    // **Styles**
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "4F81BD" } },
    };

    const subHeaderStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "4F81BD" } },
    };

    // **Header Row 1 (Merged Labels)**
    const mainHeaders = [
      "S.No.", "CL/FL/HB", "Permit No", "Date", "Company",
      "PL", "", "",
      "ML", "", "",
      "ST", "", "",
      "BR", "", "",
      "HB", "", "",
      "Total"
    ];

    ws["!merges"] = [
      { s: { r: 0, c: 5 }, e: { r: 0, c: 7 } }, // PL merge
      { s: { r: 0, c: 8 }, e: { r: 0, c: 10 } }, // ML merge
      { s: { r: 0, c: 11 }, e: { r: 0, c: 13 } }, // ST merge
      { s: { r: 0, c: 14 }, e: { r: 0, c: 16 } }, // BR merge
      { s: { r: 0, c: 17 }, e: { r: 0, c: 19 } }, // HB merge
    ];

    XLSX.utils.sheet_add_aoa(ws, [mainHeaders], { origin: "A1" });

    // **Apply styles to header**
    mainHeaders.forEach((_, colIdx) => {
      ws[XLSX.utils.encode_cell({ r: 0, c: colIdx })].s = headerStyle;
    });

    // **Header Row 2 (Subheaders)**
    const subHeaders = [
      "", "", "", "", "",
      "Qty", "StartFrom", "StartTo",
      "Qty", "StartFrom", "StartTo",
      "Qty", "StartFrom", "StartTo",
      "Qty", "StartFrom", "StartTo",
      "Qty", "StartFrom", "StartTo",
      ""
    ];
    XLSX.utils.sheet_add_aoa(ws, [subHeaders], { origin: "A2" });

    // **Apply styles to subheaders**
    subHeaders.forEach((_, colIdx) => {
      ws[XLSX.utils.encode_cell({ r: 1, c: colIdx })].s = subHeaderStyle;
    });

    // **Data Rows with Merging**
    let rowIndex = 2; // Start from row 3


    const columnWidths = mainHeaders.map(() => ({ wch: 12 }));
    columnWidths[4] = { wch: 30 };
    ws["!cols"] = columnWidths;

    // Auto-fit row height
    ws["!rows"] = Array(rowIndex).fill({ hpx: 20 });

    // Wrap text in all data cells
    // const wrapTextStyle = { alignment: { wrapText: true } };
    this.stockOutwardData.forEach((_, rowIdx) => {
      mainHeaders.forEach((_, colIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 2, c: colIdx }); // Starting from row 3
        if (ws[cellRef]) {
          // ws[cellRef].s = wrapTextStyle;
        }
      });
    });

    this.stockOutwardData.forEach((stock, index) => {
      const plData = this.getLabelData(stock, '3');
      const mlData = this.getLabelData(stock, '4');
      const stData = this.getLabelData(stock, '1');
      const brData = this.getLabelData(stock, '2');
      const hbData = this.getLabelData(stock, '5');

      const maxRows = Math.max(plData.length, mlData.length, stData.length, brData.length, hbData.length);

      // Merge the first 5 columns for this stock entry
      if (maxRows > 1) {
        ws["!merges"].push(
          { s: { r: rowIndex, c: 0 }, e: { r: rowIndex + maxRows - 1, c: 0 } }, // S.No
          { s: { r: rowIndex, c: 1 }, e: { r: rowIndex + maxRows - 1, c: 1 } }, // CL/FL/HB
          { s: { r: rowIndex, c: 2 }, e: { r: rowIndex + maxRows - 1, c: 2 } }, // Permit No
          { s: { r: rowIndex, c: 3 }, e: { r: rowIndex + maxRows - 1, c: 3 } }, // Date
          { s: { r: rowIndex, c: 4 }, e: { r: rowIndex + maxRows - 1, c: 4 } }, // Company
          { s: { r: rowIndex, c: 5 }, e: { r: rowIndex + maxRows - 1, c: 5 } }, // PL Qty
          { s: { r: rowIndex, c: 8 }, e: { r: rowIndex + maxRows - 1, c: 8 } }, // ML Qty
          { s: { r: rowIndex, c: 11 }, e: { r: rowIndex + maxRows - 1, c: 11 } }, // ST Qty
          { s: { r: rowIndex, c: 14 }, e: { r: rowIndex + maxRows - 1, c: 14 } }, // BR Qty
          { s: { r: rowIndex, c: 17 }, e: { r: rowIndex + maxRows - 1, c: 17 } }, // HB Qty
          { s: { r: rowIndex, c: 20 }, e: { r: rowIndex + maxRows - 1, c: 20 } }, // Total
        );
      }

      for (let i = 0; i < maxRows; i++) {
        const rowData = [
          i === 0 ? index + 1 : "",
          i === 0 ? stock.AppId : "",
          i === 0 ? stock.PermitNo : "",
          i === 0 ? new Date(stock.Date).toLocaleDateString() : "",
          i === 0 ? stock.Company : "",
          plData[i] ? plData[i][0] : "", plData[i] ? plData[i][1] : "", plData[i] ? plData[i][2] : "", // PL
          mlData[i] ? mlData[i][0] : "", mlData[i] ? mlData[i][1] : "", mlData[i] ? mlData[i][2] : "", // ML
          stData[i] ? stData[i][0] : "", stData[i] ? stData[i][1] : "", stData[i] ? stData[i][2] : "", // ST
          brData[i] ? brData[i][0] : "", brData[i] ? brData[i][1] : "", brData[i] ? brData[i][2] : "", // BR
          hbData[i] ? hbData[i][0] : "", hbData[i] ? hbData[i][1] : "", hbData[i] ? hbData[i][2] : "", // HB
          i === 0 ? stock.total : "",
        ];

        XLSX.utils.sheet_add_aoa(ws, [rowData], { origin: `A${rowIndex + 1}` });

        // Apply center alignment to all cells
        rowData.forEach((_, colIdx) => {
          const cell = ws[XLSX.utils.encode_cell({ r: rowIndex, c: colIdx })];
          if (cell) {
            cell.s = { alignment: { horizontal: "center", vertical: "center" } };
          }
        });

        rowIndex++;
      }
    });

    // **Create Workbook and Export**
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Outward");

    // **Generate a date string (YYYY_MM_DD)**
    const now = new Date();
    const dateString = now.toISOString().split("T")[0].replace(/-/g, "_"); // Format: YYYY_MM_DD

    // **Create the filename with date only**
    const filename = `Stock_Outward_Details_${dateString}.xlsx`;

    XLSX.writeFile(wb, filename);
  }

  exportInwardToCSV() {
    if (!this.stockInwardData || this.stockInwardData.length === 0) {
      this.toastService.show('No data to export!', { class: 'warning' });
      return;
    }

    const ws = XLSX.utils.aoa_to_sheet([]);

    // **Define Header Style**
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "4F81BD" } },
    };

    // **Header Row**
    const mainHeaders = ["Date", "DC No", "From", "PL", "ML", "ST", "BR", "HB", "Total"];
    XLSX.utils.sheet_add_aoa(ws, [mainHeaders], { origin: "A1" });

    // **Apply Styles to Header**
    mainHeaders.forEach((_, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx }); // Get cell reference
      if (!ws[cellRef]) ws[cellRef] = {}; // Ensure cell exists
      ws[cellRef].s = headerStyle; // Apply style
    });

    // **Data Rows**
    let rowIndex = 1;
    const merges: any[] = [];

    this.stockInwardData.forEach((stock) => {
      const maxRows = Math.max(stock.dcNo.length, stock.fromPlace.length); // Get max for merging
      const rowData: any[] = [];

      for (let i = 0; i < maxRows; i++) {
        rowData.push([
          i === 0 ? stock.date : "", // Merge Date
          stock.dcNo[i] || "", // DC No
          // stock.fromPlace[i] || "", // From Place
          this.placeFromList.find(place => place.Place_Id == stock.fromPlace[i])?.Place_Name || "", // From Place
          i === 0 ? stock.count.PL : "", // PL
          i === 0 ? stock.count.ML : "", // ML
          i === 0 ? stock.count.ST : "", // ST
          i === 0 ? stock.count.BR : "", // BR
          i === 0 ? stock.count.HB : "", // HB
          i === 0 ? stock.count.Total : "", // Total
        ]);
      }

      XLSX.utils.sheet_add_aoa(ws, rowData, { origin: `A${rowIndex + 1}` });

      // **Merging Cells**
      if (maxRows > 1) {
        merges.push(
          { s: { r: rowIndex, c: 0 }, e: { r: rowIndex + maxRows - 1, c: 0 } }, // Merge Date
          { s: { r: rowIndex, c: 3 }, e: { r: rowIndex + maxRows - 1, c: 3 } }, // Merge PL
          { s: { r: rowIndex, c: 4 }, e: { r: rowIndex + maxRows - 1, c: 4 } }, // Merge ML
          { s: { r: rowIndex, c: 5 }, e: { r: rowIndex + maxRows - 1, c: 5 } }, // Merge ST
          { s: { r: rowIndex, c: 6 }, e: { r: rowIndex + maxRows - 1, c: 6 } }, // Merge BR
          { s: { r: rowIndex, c: 7 }, e: { r: rowIndex + maxRows - 1, c: 7 } }, // Merge HB
          { s: { r: rowIndex, c: 8 }, e: { r: rowIndex + maxRows - 1, c: 8 } }, // Merge Total
        );
      }

      rowIndex += maxRows;
    });

    // **Apply Merges**
    ws["!merges"] = merges;

    // **Auto-adjust Column Width**
    ws["!cols"] = mainHeaders.map((_, i) => ({ wch: 15 })); // Adjust width as needed

    // **Auto-adjust Row Height**
    ws["!rows"] = new Array(rowIndex).fill({ hpt: 20 }); // Set height in points

    // **Create Workbook and Export**
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Inward");

    // **Generate Filename**
    const now = new Date();
    const dateString = now.toISOString().split("T")[0].replace(/-/g, "_");
    const filename = `Stock_Inward_Details_${dateString}.xlsx`;

    XLSX.writeFile(wb, filename);
  }

  exportLedgerToCSV() {
    const headerStyleInward = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },  // White text
      fill: { fgColor: { rgb: '4F81BD' } },           // Blue background
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const headerStyleOutward = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },  // White text
      fill: { fgColor: { rgb: '9BBB59' } },           // Green background
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const subHeaderStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },  // White text
      fill: { fgColor: { rgb: '595959' } },           // Dark Gray background (better contrast)
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const worksheetData: any[] = [];

    // Header Row
    worksheetData.push([
      { v: 'Stock Inward', s: headerStyleInward }, '', '', '', '', '', '', '', '',
      { v: 'Stock Outward', s: headerStyleOutward }, '', '', '', '', '', '', '', ''
    ]);

    worksheetData.push([
      { v: 'Date', s: subHeaderStyle }, { v: 'DC No', s: subHeaderStyle }, { v: 'From', s: subHeaderStyle },
      { v: 'PL', s: subHeaderStyle }, { v: 'ML', s: subHeaderStyle }, { v: 'ST', s: subHeaderStyle },
      { v: 'BR', s: subHeaderStyle }, { v: 'HB', s: subHeaderStyle }, { v: 'Total', s: subHeaderStyle },
      { v: 'Date', s: subHeaderStyle }, { v: 'Permit No', s: subHeaderStyle }, { v: 'To', s: subHeaderStyle },
      { v: 'PL', s: subHeaderStyle }, { v: 'ML', s: subHeaderStyle }, { v: 'ST', s: subHeaderStyle },
      { v: 'BR', s: subHeaderStyle }, { v: 'HB', s: subHeaderStyle }, { v: 'Total', s: subHeaderStyle }
    ]);


    // Populate Data
    this.transactions.forEach((tx) => {
      if (tx.type === 'ob') {
        worksheetData.push([
          tx.date, '-', 'O/B', tx.count.PL, tx.count.ML, tx.count.ST, tx.count.BR, tx.count.HB, tx.count.Total,
          '', '', '', '', '', '', '', '', ''
        ]);
      } else if (tx.type === 'inward') {
        // worksheetData.push([
        //   tx.date, tx.dcNo?.[0] || '-', tx.fromPlace?.[0] || '-', tx.count.PL, tx.count.ML, tx.count.ST,
        //   tx.count.BR, tx.count.HB, tx.count.Total,
        //   '', '', '', '', '', '', '', '', ''
        // ]);
          worksheetData.push([
          tx.date, tx.dcNo?.join(', ') || '-', tx.fromPlace?.join(', ') || '-', tx.count.PL, tx.count.ML, tx.count.ST,
          tx.count.BR, tx.count.HB, tx.count.Total,
          '', '', '', '', '', '', '', '', ''
        ]);
      } else if (tx.type === 'outward') {
        worksheetData.push([
          '', '', '', '', '', '', '', '', '',
          tx.date, tx.permitNo?.join(', ') || '-', tx.to || '-', tx.count.PL, tx.count.ML, tx.count.ST,
          tx.count.BR, tx.count.HB, tx.count.Total
        ]);
      } else if (tx.type === 'cb') {
        worksheetData.push([
          '', '', '', '', '', '', '', '', '',
          tx.date, '-', 'C/B', tx.count.PL, tx.count.ML, tx.count.ST, tx.count.BR, tx.count.HB, tx.count.Total
        ]);
      }
    });

    // Create worksheet and workbook
    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(worksheetData);

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },  // Merging "Stock Inward"
      { s: { r: 0, c: 9 }, e: { r: 0, c: 17 } }, // Merging "Stock Outward"
    ];

    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Ledger');

    // **Set Column Widths**
    ws['!cols'] = [
      { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
      { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }
    ];

    // **Set Row Heights**
    ws['!rows'] = [
      { hpt: 25 }, // Header height
      { hpt: 20 }, // Subheader height
      ...Array(worksheetData.length - 2).fill({ hpt: 18 }) // Data rows height
    ];

    // **Generate Filename**
    const now = new Date();
    const dateString = now.toISOString().split("T")[0].replace(/-/g, "_");
    const filename = `Stock_Ledger${dateString}.xlsx`;

    XLSX.writeFile(wb, filename);
  }

  getLabelData(stock: any, label: string): string[][] {
    if (stock.Labels[label]) {
      const qty = stock.Labels[label].qty; // Get Qty once
      const numbering = stock.Labels[label].numbering || [];

      if (numbering.length > 0) {
        return numbering.map((n, index) => [
          index === 0 ? qty : "", // Show Qty only for the first row
          n.StartFrom,
          n.StartTo
        ]);
      }
    }
    return [["--", "--", "--"]];
  }


  transformStockData(stockData: any) {
    return stockData.map((row: any) => {
      const transformedLabels: any = {};
      let totalLiquorCount = 0;

      Object.keys(row.Labels).forEach(labelType => {
        const labelEntries = row.Labels[labelType];

        // Sort by StartFrom
        labelEntries.sort((a: any, b: any) => Number(a.StartFrom) - Number(b.StartFrom));

        let mergedRanges: any[] = [];
        let currentRange: any = null;

        for (let label of labelEntries) {
          if (!currentRange) {
            // Start a new range
            currentRange = { StartFrom: label.StartFrom, StartTo: label.StartTo };
          } else {
            // If sequential, merge the range
            if (Number(label.StartFrom) === Number(currentRange.StartTo) + 1) {
              currentRange.StartTo = label.StartTo;
            } else {
              // Push the completed range and start a new one
              mergedRanges.push(currentRange);
              currentRange = { StartFrom: label.StartFrom, StartTo: label.StartTo };
            }
          }
        }

        // Push the last range
        if (currentRange) {
          mergedRanges.push(currentRange);
        }

        // Compute sum of quantities for this label type
        const labelQty = labelEntries.reduce((sum: number, item: any) => sum + item.Qty, 0);

        // Add to total count
        totalLiquorCount += labelQty;

        transformedLabels[labelType] = {
          qty: labelEntries.reduce((sum: number, item: any) => sum + item.Qty, 0), // Sum of quantities
          numbering: mergedRanges // Store merged ranges instead of all entries
        };
      });

      return {
        ...row,
        Labels: transformedLabels,
        total: totalLiquorCount
      };
    });
  }

  onInwardSelection() {
    this.selectedTab = 'inward';
    this.loadStockInwardDetails();
  }

  onOutwardSelection() {
    this.selectedTab = 'outward';
    this.loadStockOutwardDetails();
  }

  onLedgerSelection() {
    this.selectedTab = 'ledger';
    this.loadStockLedgerDetails();
  }

  loadStockInwardDetails() {
    this.loader = true;
    this.stockInwardData = [];
    this.stockOutwardData = [];
    this.stockLedgerData = [];
    this.stockService.getStockInwardDetails().subscribe(
      (data) => {
        let inwardData = this.transformStockInwardData(data);
        this.loader = false;
      },
      (error) => {
        console.error('Error fetching stock data:', error);
        this.loader = false;
      }
    );
  }

  transformStockInwardData(stockInward: any) {
    const transactionMap: { [key: string]: StockTransaction[] } = {};

    // Process Stock Inward
    for (const [date, entry] of Object.entries(stockInward.StockInward || {}) as [string, { DC_NO: string[]; FromPlace: string[]; Count: any }][]) {
      if (!transactionMap[date]) transactionMap[date] = [];

      transactionMap[date].push({
        date,
        dcNo: Array.from(new Set(entry.DC_NO || [])), // Ensure unique values
        fromPlace: Array.from(new Set(entry.FromPlace || [])), // Ensure unique values
        count: { ...entry.Count }, // Copy count object safely
        type: 'inward',
      });
    }
    // Convert transactionMap to an array format
    this.stockInwardData = Object.values(transactionMap).flat();
    this.stockInwardData.forEach(tx => {
      tx.fromPlace = tx.fromPlace.map(placeId => this.placeFromList.find(p => p.Place_Id == placeId)?.Place_Name || '');
    });

  }

  loadStockLedgerDetails() {
    this.loader = true;
    this.stockInwardData = [];
    this.stockOutwardData = [];
    this.stockLedgerData = [];
    this.stockService.getStockLedgerDetails().subscribe(
      (data) => {
        this.processStockData(data);
        this.loader = false;
      },
      (error) => {
        console.error('Error fetching stock data:', error);
      }
    );
  }


  transactions: StockTransaction[] = [];
  runningBalance = { PL: 0, ML: 0, ST: 0, BR: 0, HB: 0, Total: 0 };

  processStockData(stockData: any) {
    let tempBalance = { ...this.runningBalance };
    const transactionMap: { [key: string]: StockTransaction[] } = {};

    // Process Stock Inward
    for (const [date, entry] of Object.entries(stockData.StockInward || {}) as [string, any][]) {
      if (!transactionMap[date]) transactionMap[date] = [];
      transactionMap[date].push({
        date,
        dcNo: Array.from(new Set(entry.DC_NO || [])),
        fromPlace: Array.from(new Set(entry.FromPlace || [])),
        count: { ...entry.Count },
        type: 'inward',
      });
    }

    // Process Stock Outward
    for (const [date, entries] of Object.entries(stockData.StockOutward || {})) {
      if (!transactionMap[date]) transactionMap[date] = [];
      (entries as any[]).forEach(entry => {
        transactionMap[date].push({
          date,
          permitNo: entry?.Permit_NO || [],
          supplierName: entry?.SupplierName || '',
          to: entry?.SupplierName || '',
          count: { ...entry.Count },
          type: 'outward',
        });
      });
    }

    // Sort dates to process transactions sequentially
    const sortedDates = Object.keys(transactionMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    this.transactions = [];
    let previousBalance = { ...this.runningBalance };

    // Process daily transactions
    for (const date of sortedDates) {
      const dailyTransactions = transactionMap[date];

      // Add Opening Balance for the day
      this.transactions.push({ date, count: { ...previousBalance }, type: 'ob' });

      let hasTransactions = false;

      // Process all inward and outward transactions
      dailyTransactions.forEach(tx => {
        hasTransactions = true;
        this.transactions.push(tx);

        // Update balance
        if (tx.type === 'inward') {
          Object.keys(previousBalance).forEach(key => (previousBalance[key] += tx.count[key] || 0));
        } else if (tx.type === 'outward') {
          Object.keys(previousBalance).forEach(key => (previousBalance[key] -= tx.count[key] || 0));
        }
      });

      // Add Closing Balance for the day (even if there were only inward transactions)
      if (hasTransactions) {
        this.transactions.push({ date, count: { ...previousBalance }, type: 'cb' });
      } else {
        // If no transactions, just carry forward the previous balance as C/B
        this.transactions.push({ date, count: { ...previousBalance }, type: 'cb' });
      }
    }
    this.transactions.forEach(tx => {
      if(tx.fromPlace) {
        tx.fromPlace = tx.fromPlace.map(placeId => this.placeFromList.find(p => p.Place_Id == placeId)?.Place_Name || '');
      }
    });
  }

}