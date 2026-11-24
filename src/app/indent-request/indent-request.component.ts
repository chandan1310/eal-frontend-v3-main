import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { StockService } from '../services/stock.service';
import { ToastService } from '../services/toast.service';
import { IndentListComponent, IndentAction } from '../shared/indent-list.component';
import { IndentDetailComponent } from '../shared/indent-detail.component';

/**
 * Indent Request – Nashik Admin (label press).
 *   Pending  → Approve (boxes to give per EAL type – may be fewer than asked, expected dispatch date) or Reject (reason).
 *   Approved → Dispatch: opens Stock Entry with this indent selected; every box entered there counts
 *              against the indent until it is fully Dispatched.
 */
@Component({
  selector: 'app-indent-request',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, IndentListComponent, IndentDetailComponent],
  templateUrl: './indent-request.component.html',
  styleUrls: ['../shared/indent-ui.css']
})
export class IndentRequestComponent implements OnInit {
  readonly labelsPerBox = 90000;
  indents: any[] = [];
  loading = false;
  busy = false;
  viewNo: string | null = null;
  today = new Date().toISOString().split('T')[0];

  /** dialog */
  target: any = null;
  targetAction: 'Approve' | 'Reject' | null = null;
  remark = '';
  expectedDate = '';
  give: Record<number, number> = {};

  constructor(private stockService: StockService, private toast: ToastService, private router: Router) { }

  ngOnInit(): void { this.loadIndents(); }

  loadIndents(): void {
    this.loading = true;
    this.stockService.indentList().subscribe({
      next: (list) => { this.indents = Array.isArray(list) ? list : []; this.loading = false; },
      error: (err) => {
        this.indents = []; this.loading = false;
        this.toast.show(err?.error?.message || 'Could not load indents.', { class: 'danger' });
      }
    });
  }

  get pending(): number { return this.indents.filter(i => i.Status === 'Pending').length; }
  get urgentPending(): number { return this.indents.filter(i => i.Status === 'Pending' && i.Priority === 'Urgent').length; }
  get toDispatch(): number { return this.indents.filter(i => i.Status === 'Approved' || i.Status === 'Partially Dispatched').length; }
  get boxesToDispatch(): number {
    return this.indents.filter(i => i.Status === 'Approved' || i.Status === 'Partially Dispatched')
      .reduce((s, i) => s + (i.BalanceBoxes || 0), 0);
  }
  get dispatched(): number { return this.indents.filter(i => i.Status === 'Dispatched').length; }

  onListAction(e: { indent: any; action: IndentAction }): void {
    if (e.action === 'View') { this.viewNo = e.indent.IndentNo; return; }
    if (e.action === 'Dispatch') {
      // the Stock Entry page in this login's menu (stockentry or nashik-stockentry)
      let allowed: string[] = [];
      try { allowed = JSON.parse(sessionStorage.getItem('allowed_routes') || '[]'); } catch { allowed = []; }
      const norm = (u: string) => (u || '').replace(/^\/+/, '').toLowerCase();
      const route = allowed.map(norm).find(u => u === 'stockentry' || u === 'nashik-stockentry') || 'stockentry';
      this.router.navigate(['/' + route], { queryParams: { indent: e.indent.IndentNo } });
      return;
    }
    if (e.action === 'Approve' || e.action === 'Reject') {
      this.target = e.indent;
      this.targetAction = e.action;
      this.remark = '';
      this.expectedDate = '';
      this.give = {};
      (e.indent.Items || []).forEach((x: any) => this.give[x.IndentId] = x.BoxQty);
    }
  }

  setGive(x: any, v: any): void {
    const n = Math.floor(Number(v));
    this.give[x.IndentId] = isNaN(n) || n < 0 ? 0 : Math.min(n, x.BoxQty);
  }
  get giveTotal(): number { return Object.values(this.give).reduce((s, n) => s + (n || 0), 0); }
  get reduced(): boolean { return (this.target?.Items || []).some((x: any) => (this.give[x.IndentId] ?? x.BoxQty) < x.BoxQty); }

  closeDialog(): void { this.target = null; this.targetAction = null; this.remark = ''; }

  confirm(): void {
    if (!this.target || !this.targetAction) return;
    const remark = this.remark.trim();
    if (this.targetAction === 'Reject' && !remark) { this.toast.show('Please enter the reason for rejection.', { class: 'warning' }); return; }
    if (this.targetAction === 'Approve') {
      if (this.giveTotal === 0) { this.toast.show('Approve at least one box, or reject the indent.', { class: 'warning' }); return; }
      if (this.reduced && !remark) { this.toast.show('You are giving fewer boxes than asked – write the reason.', { class: 'warning' }); return; }
    }
    const extra = this.targetAction === 'Approve'
      ? { ExpectedDispatchDate: this.expectedDate || null,
          Items: (this.target.Items || []).map((x: any) => ({ IndentId: x.IndentId, ApprovedBoxQty: this.give[x.IndentId] ?? x.BoxQty })) }
      : {};
    this.busy = true;
    this.stockService.indentAction(this.target.IndentNo, this.targetAction, remark, extra).subscribe({
      next: (res: any) => {
        this.busy = false; this.closeDialog();
        this.toast.show(res?.message || 'Done.', { class: 'success' });
        this.loadIndents();
      },
      error: (err) => {
        this.busy = false;
        this.toast.show(err?.error?.message || 'Could not update the indent.', { class: 'danger' });
      }
    });
  }
}
