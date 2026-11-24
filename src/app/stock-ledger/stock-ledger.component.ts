import { Component } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StockService } from '../services/stock.service';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx-js-style';


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
    selector: 'app-stock-ledger',
    standalone: true,
    imports: [SidebarComponent, FormsModule],
    templateUrl: './stock-ledger.component.html',
    styleUrl: './stock-ledger.component.css'
})
export class StockLedgerComponent {

  stockLedgerData: any[] = [];
  stockInward: any[] = [];
  stockOutward: any[] = [];

  constructor(private stockService: StockService) { }

  ngOnInit(): void {
    this.loadStockLedgerDetails();
  }

  loadStockLedgerDetails() {
    this.stockService.getStockLedgerDetails().subscribe(
      (data) => {
        // this.stockLedgerData = data;
        this.processStockData(data);
        // console.log(this.stockLedgerData);
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
        dcNo: entry?.DC_NO || [],
        fromPlace: entry?.FromPlace || [],
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

    // console.log('Updated transactions:', this.transactions);
  }

  exportToCSV() {
    let csvContent = 'Stock Inward,,,,,,,Stock Outward\n';
    csvContent += 'Date,DC No,From,PL,ML,ST,BR,HB,Total,Date,PN,To,PL,ML,ST,BR,HB,Total\n';

    const maxRows = Math.max(this.stockInward.length, this.stockOutward.length);
    for (let i = 0; i < maxRows; i++) {
      const inward = this.stockInward[i] || {};
      const outward = this.stockOutward[i] || {};
      csvContent += `${inward.date || ''},${inward.DC_NO || ''},${inward.FromPlace || ''},${inward.PL || ''},${inward.ML || ''},${inward.ST || ''},${inward.BR || ''},${inward.HB || ''},${inward.Total || ''},${outward.date || ''},${outward.Permit_NO || ''},${outward.SupplierName || ''},${outward.PL || ''},${outward.ML || ''},${outward.ST || ''},${outward.BR || ''},${outward.HB || ''},${outward.Total || ''}\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    saveAs(blob, 'stock_ledger.csv');
  }

  exportToExcel() {
    const ws: XLSX.WorkSheet = XLSX.utils.table_to_sheet(document.getElementById('stock-table'));
    const wb: XLSX.WorkBook = {
      Sheets: { 'Stock Data': ws },
      SheetNames: ['Stock Data'],
    };
    // Set the file name
    XLSX.writeFile(wb, 'stock_data.xlsx');
  }
  
}
