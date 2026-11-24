import { Component, EventEmitter, Input, OnChanges, Output, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StockService } from '../services/stock.service';
import { indentStatusClass } from './indent-list.component';

/**
 * Indent detail drawer: timeline, asked / approved / sent per EAL type, notes, dispatch history (boxes entered
 * in Stock Entry against the indent) and a printable indent order. Styles: shared/indent-ui.css.
 */
@Component({
  selector: 'app-indent-detail',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./indent-ui.css'],
  template: `
@if (indentNo) {
  <div class="ix-backdrop ix-noprint" (click)="closed.emit()"></div>
  <aside class="ix-panel">
    <div class="ix-panel-head">
      <div>
        <div class="ix-print-only" style="font-weight:700; font-size:1.1rem;">Excise Department · Label Indent Order</div>
        <div style="font-size:1.15rem; font-weight:700;">Indent #{{ indentNo }}
          @if (d?.Priority === 'Urgent') { <span class="ix-urgent">URGENT</span> }</div>
        @if (d) {
          <div style="font-size:.78rem; opacity:.8;">{{ d.FinancialYear }} · Period {{ d.StartDate | date:'dd MMM yyyy' }} – {{ d.EndDate | date:'dd MMM yyyy' }}</div>
        }
      </div>
      <div class="ix-row ix-noprint">
        @if (d) { <span class="ix-status" [ngClass]="statusClass(d.Status)">{{ d.Status }}</span> }
        <button type="button" class="ix-x white" (click)="closed.emit()" aria-label="Close">&times;</button>
      </div>
    </div>

    <div class="ix-panel-body">
      @if (loading) { <div class="ix-xs" style="padding:30px; text-align:center;">Loading…</div> }
      @if (error) { <div class="ix-note red">{{ error }}</div> }

      @if (d) {
        <div class="ix-section" style="margin-top:0">Progress</div>
        <ul class="ix-timeline">
          <li class="done"><span class="dot"></span>
            <b>Raised by Section</b> <span class="ix-xs">{{ d.CreatedDate | date:'dd MMM yyyy, h:mm a' }} · {{ d.CreatedByName || '—' }}</span>
          </li>
          @if (d.Status === 'Pending') {
            <li class="now"><span class="dot"></span><b>Waiting for Nashik</b> <span class="ix-xs">to approve or reject</span></li>
          } @else if (d.Status === 'Cancelled') {
            <li class="bad"><span class="dot"></span><b>Cancelled by Section</b> <span class="ix-xs">{{ d.ActionDate | date:'dd MMM yyyy' }}</span></li>
          } @else if (d.Status === 'Rejected') {
            <li class="bad"><span class="dot"></span><b>Rejected by Nashik</b> <span class="ix-xs">{{ d.ActionDate | date:'dd MMM yyyy' }} · {{ d.ActionByName }}</span></li>
          } @else {
            <li class="done"><span class="dot"></span>
              <b>Approved by Nashik</b> <span class="ix-xs">{{ d.ActionDate | date:'dd MMM yyyy' }} · {{ d.ActionByName }}</span>
              @if (d.ApprovedBoxes != null && d.ApprovedBoxes < d.RequestedBoxes) {
                <div class="ix-xs">{{ d.ApprovedBoxes }} of {{ d.RequestedBoxes }} boxes approved</div>
              }
              @if (d.ExpectedDispatchDate) { <div class="ix-xs">Expected dispatch: {{ d.ExpectedDispatchDate | date:'dd MMM yyyy' }}</div> }
            </li>
            <li [class.done]="d.Status === 'Dispatched'" [class.now]="d.Status !== 'Dispatched'"><span class="dot"></span>
              <b>{{ d.Status === 'Dispatched' ? 'Fully dispatched' : 'Dispatching' }}</b>
              <span class="ix-xs">{{ d.DispatchedBoxes }} of {{ d.TotalBoxes }} boxes sent
                @if (d.LastDispatchDate) { · last {{ d.LastDispatchDate | date:'dd MMM yyyy' }} }</span>
            </li>
          }
        </ul>

        <div class="ix-section">Boxes</div>
        <table class="ix-table">
          <thead><tr><th>EAL type</th><th class="ix-right">Asked</th><th class="ix-right">Approved</th><th class="ix-right">Sent</th><th class="ix-right">Left</th></tr></thead>
          <tbody>
            @for (x of d.Items; track x.IndentId) {
              <tr>
                <td><div class="ix-type"><span class="ix-code">{{ x.ComponentCode }}</span><div><b>{{ x.ComponentName }}</b><div class="ix-xs">{{ x.ComponentType }}</div></div></div></td>
                <td class="ix-right">{{ x.BoxQty }}</td>
                <td class="ix-right">{{ x.ApprovedBoxQty ?? '—' }}</td>
                <td class="ix-right">{{ x.DispatchedBoxes }}</td>
                <td class="ix-right">{{ isOpen ? x.BalanceBoxes : '—' }}</td>
              </tr>
            }
          </tbody>
          <tfoot><tr>
            <td>Total · {{ d.TotalUnits | number }} labels</td>
            <td class="ix-right">{{ d.RequestedBoxes }}</td>
            <td class="ix-right">{{ d.ApprovedBoxes ?? '—' }}</td>
            <td class="ix-right">{{ d.DispatchedBoxes }}</td>
            <td class="ix-right">{{ isOpen ? d.BalanceBoxes : '—' }}</td>
          </tr></tfoot>
        </table>
        <div class="ix-xs" style="margin-top:6px">1 box = 90,000 labels (9 spools × 10,000).</div>

        @if (d.Remark || d.ActionRemark) {
          <div class="ix-section">Notes</div>
          @if (d.Remark) { <div class="ix-note"><b>Section:</b> {{ d.Remark }}</div> }
          @if (d.ActionRemark) { <div class="ix-note" [class.red]="d.Status === 'Rejected'"><b>Nashik:</b> {{ d.ActionRemark }}</div> }
        }

        @if (dispatches.length) {
          <div class="ix-section">Dispatch history ({{ dispatches.length }} boxes)</div>
          <table class="ix-table">
            <thead><tr><th>Date</th><th>DC no.</th><th>Box</th><th>Label serials</th></tr></thead>
            <tbody>
              @for (b of dispatches; track b.BoxId) {
                <tr>
                  <td class="ix-nowrap">{{ b.EntryDate | date:'dd MMM yyyy' }}</td>
                  <td>{{ b.DcNo }}</td>
                  <td>{{ b.BoxNo }}<div class="ix-xs">{{ b.EALName }}</div></td>
                  <td class="ix-mono ix-xs">{{ b.FromNo }} – {{ b.ToNo }}</td>
                </tr>
              }
            </tbody>
          </table>
        }

        <div class="ix-print-only" style="margin-top:50px;">
          <div style="display:flex; justify-content:space-between;"><div>Raised by: {{ d.CreatedByName }}</div><div>Signature: ____________________</div></div>
        </div>
      }
    </div>

    <div class="ix-panel-foot ix-noprint">
      <button type="button" class="ix-btn ghost" (click)="print()" [disabled]="!d"><i class="fa fa-print"></i> Print</button>
      <button type="button" class="ix-btn" (click)="closed.emit()">Close</button>
    </div>
  </aside>
}
`
})
export class IndentDetailComponent implements OnChanges {
  @Input() indentNo: string | null = null;
  @Output() closed = new EventEmitter<void>();

  d: any = null;
  dispatches: any[] = [];
  loading = false;
  error = '';

  constructor(private stock: StockService) {}

  ngOnChanges(): void {
    this.d = null; this.dispatches = []; this.error = '';
    if (!this.indentNo) return;
    this.loading = true;
    this.stock.indentDetail(this.indentNo).subscribe({
      next: res => { this.d = res?.Indent; this.dispatches = res?.Dispatches || []; this.loading = false; },
      error: err => { this.loading = false; this.error = err?.error?.message || 'Could not load the indent.'; }
    });
  }

  get isOpen(): boolean { return ['Approved', 'Partially Dispatched', 'Dispatched'].includes(this.d?.Status); }
  statusClass(s: string): string { return indentStatusClass(s); }
  print(): void { window.print(); }
}