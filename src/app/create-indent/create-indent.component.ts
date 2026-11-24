import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { StockService } from '../services/stock.service';
import { ToastService } from '../services/toast.service';
import { IndentListComponent, IndentAction } from '../shared/indent-list.component';
import { IndentDetailComponent } from '../shared/indent-detail.component';

interface IndentRow {
  EALTypeId: number; Name: string; Type: string; Code: string;
  InStockLabels: number; OnOrderBoxes: number; MonthlyIssued: number; MonthsCover: number | null; SuggestedBoxes: number;
  boxQty: number;
}

/**
 * Create Indent – the Section login orders labels from the Nashik press.
 *   Per EAL type it shows stock, boxes already on order, monthly issue, months of cover and a suggestion,
 *   then sends the indent (period, priority, note) to Nashik Admin as "Pending". Section can cancel it while Pending.
 *   Admin / Commissioner open this page in view-only mode.
 */
@Component({
  selector: 'app-create-indent',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, IndentListComponent, IndentDetailComponent],
  templateUrl: './create-indent.component.html',
  styleUrls: ['../shared/indent-ui.css']
})
export class CreateIndentComponent implements OnInit {
  labelsPerBox = 90000;

  canCreate = false;
  accessLoaded = false;

  rows: IndentRow[] = [];
  indents: any[] = [];
  loading = false;
  saving = false;

  startDate = '';
  endDate = '';
  priority: 'Normal' | 'Urgent' = 'Normal';
  remark = '';
  today = this.iso(new Date());

  confirmOpen = false;
  cancelTarget: any = null;
  viewNo: string | null = null;

  constructor(private stockService: StockService, private toast: ToastService) { }

  ngOnInit(): void {
    this.setNextMonth();
    this.stockService.indentMyAccess().subscribe({
      next: a => {
        this.canCreate = !!a?.CanCreate;
        this.labelsPerBox = a?.LabelsPerBox || this.labelsPerBox;
        this.accessLoaded = true;
        if (this.canCreate) this.loadInfo();
      },
      error: () => { this.accessLoaded = true; }
    });
    this.loadIndents();
  }

  private iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Default period: next calendar month. */
  setNextMonth(): void {
    const n = new Date();
    this.startDate = this.iso(new Date(n.getFullYear(), n.getMonth() + 1, 1));
    this.endDate = this.iso(new Date(n.getFullYear(), n.getMonth() + 2, 0));
  }

  loadInfo(): void {
    this.stockService.indentCreateInfo().subscribe({
      next: (res: any) => {
        this.rows = (res?.Types || []).map((t: any) => ({ ...t, boxQty: 0 }));
      },
      error: () => this.toast.show('Could not load EAL types.', { class: 'danger' })
    });
  }

  loadIndents(): void {
    this.loading = true;
    this.stockService.indentList().subscribe({
      next: (list) => { this.indents = Array.isArray(list) ? list : []; this.loading = false; },
      error: () => { this.indents = []; this.loading = false; }
    });
  }

  // ---------- quantities
  setBoxes(row: IndentRow, value: any): void {
    const n = Math.floor(Number(value));
    row.boxQty = isNaN(n) || n < 0 ? 0 : Math.min(n, 10000);
  }
  step(row: IndentRow, by: number): void { this.setBoxes(row, (row.boxQty || 0) + by); }
  useSuggestion(row: IndentRow): void { row.boxQty = row.SuggestedBoxes; }
  useAllSuggestions(): void { this.rows.forEach(r => { if (r.SuggestedBoxes > 0) r.boxQty = r.SuggestedBoxes; }); }
  get anySuggestion(): boolean { return this.rows.some(r => r.SuggestedBoxes > 0); }

  boxesInStock(r: IndentRow): number { return Math.floor((r.InStockLabels || 0) / this.labelsPerBox * 10) / 10; }
  coverClass(r: IndentRow): string {
    if (r.MonthsCover == null) return '';
    return r.MonthsCover < 1 ? 'low' : r.MonthsCover < 2 ? 'mid' : 'ok';
  }

  get chosen(): IndentRow[] { return this.rows.filter(r => r.boxQty > 0); }
  get totalBoxes(): number { return this.rows.reduce((s, r) => s + (r.boxQty || 0), 0); }
  get totalLabels(): number { return this.totalBoxes * this.labelsPerBox; }

  // ---------- stats
  count(...statuses: string[]): number { return this.indents.filter(i => statuses.includes(i.Status)).length; }
  get boxesOnTheWay(): number {
    return this.indents.filter(i => i.Status === 'Approved' || i.Status === 'Partially Dispatched')
      .reduce((s, i) => s + (i.BalanceBoxes || 0), 0);
  }

  // ---------- submit
  private validate(): string {
    if (!this.startDate || !this.endDate) return 'Select the period.';
    if (this.endDate < this.startDate) return 'To date cannot be before From date.';
    if (this.endDate < this.today) return 'The period has already ended.';
    if (this.totalBoxes === 0) return 'Enter boxes for at least one EAL type.';
    if (this.priority === 'Urgent' && this.remark.trim().length < 5) return 'Write why the indent is urgent.';
    return '';
  }

  review(): void {
    const err = this.validate();
    if (err) { this.toast.show(err, { class: 'warning' }); return; }
    this.confirmOpen = true;
  }

  send(): void {
    const items = this.chosen.map(r => ({ EALTypeId: r.EALTypeId, BoxQty: r.boxQty }));
    this.saving = true;
    this.stockService.createIndentV2({
      StartDate: this.startDate, EndDate: this.endDate, Priority: this.priority, Remark: this.remark.trim(), Items: items
    }).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.confirmOpen = false;
        this.toast.show(res?.message || 'Indent sent.', { class: 'success' });
        this.rows.forEach(r => r.boxQty = 0);
        this.remark = ''; this.priority = 'Normal';
        this.setNextMonth();
        this.loadIndents();
        this.loadInfo();
        if (res?.IndentNo) this.viewNo = res.IndentNo;
      },
      error: (err) => {
        this.saving = false;
        this.toast.show(err?.error?.message || 'Could not create the indent.', { class: 'danger' });
      }
    });
  }

  // ---------- list
  onListAction(e: { indent: any; action: IndentAction }): void {
    if (e.action === 'View') this.viewNo = e.indent.IndentNo;
    if (e.action === 'Cancel') this.cancelTarget = e.indent;
  }

  confirmCancel(): void {
    const ind = this.cancelTarget;
    if (!ind) return;
    this.stockService.indentAction(ind.IndentNo, 'Cancel').subscribe({
      next: (res: any) => { this.cancelTarget = null; this.toast.show(res?.message || 'Indent cancelled.', { class: 'success' }); this.loadIndents(); this.loadInfo(); },
      error: (err) => { this.cancelTarget = null; this.toast.show(err?.error?.message || 'Could not cancel.', { class: 'danger' }); this.loadIndents(); }
    });
  }
}