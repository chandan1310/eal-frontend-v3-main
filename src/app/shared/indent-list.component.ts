import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type IndentAction = 'View' | 'Approve' | 'Reject' | 'Cancel' | 'Dispatch';

/**
 * Indent table shared by Create Indent (Section / view-only for Admin) and Indent Request (Nashik Admin).
 * One row per indent; clicking a row opens the detail drawer (action "View").
 * Styles: shared/indent-ui.css (loaded by the page).
 */
@Component({
  selector: 'app-indent-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./indent-ui.css'],
  template: `
<div class="ix-row ix-between ix-mb">
  <div class="ix-chips">
    <button type="button" class="ix-chip" [class.on]="!statusFilter" (click)="statusFilter = ''">All <span>{{ indents.length || 0 }}</span></button>
    @for (s of statuses; track s) {
      @if (count(s) > 0) {
        <button type="button" class="ix-chip" [class.on]="statusFilter === s" (click)="statusFilter = s">{{ s }} <span>{{ count(s) }}</span></button>
      }
    }
  </div>
  <input type="search" class="form-control ix-search" placeholder="Search indent no. or EAL type" [(ngModel)]="search" />
</div>

<div class="ix-scroll">
  <table class="ix-table">
    <thead>
      <tr>
        <th>Indent</th>
        <th>Period</th>
        <th>EAL type · boxes</th>
        <th class="ix-right">Labels</th>
        <th>Dispatch</th>
        <th>Status</th>
        <th class="ix-right"></th>
      </tr>
    </thead>
    <tbody>
      @if (loading) {
        <tr><td colspan="7" class="ix-right" style="text-align:center; padding:40px; color:#94a3b8;">Loading…</td></tr>
      } @else {
        @for (i of filtered; track i.IndentNo) {
          <tr class="ix-click" (click)="emit(i, 'View')">
            <td class="ix-nowrap">
              <b>#{{ i.IndentNo }}</b>@if (i.Priority === 'Urgent') { <span class="ix-urgent">URGENT</span> }
              <div class="ix-xs">{{ i.CreatedDate | date:'dd MMM yyyy' }}</div>@if (i.CreatedByName) { <div class="ix-xs">by {{ i.CreatedByName }}</div> }
            </td>
            <td class="ix-nowrap">{{ i.StartDate | date:'dd MMM' }} – {{ i.EndDate | date:'dd MMM yy' }}<div class="ix-xs">{{ i.FinancialYear }}</div></td>
            <td>
              @for (x of i.Items; track x.IndentId) {
                <span class="ix-item" [class.ix-item-odd]="!x.EALTypeId" [title]="x.ComponentType || ''">
                  <b>{{ x.ComponentCode }}</b><span class="ix-item-name">{{ x.ComponentName }}</span>
                  @if (x.ApprovedBoxQty != null && x.ApprovedBoxQty !== x.BoxQty) { <s>{{ x.BoxQty }}</s><em>{{ x.ApprovedBoxQty }}</em> }
                  @else { <em>{{ x.BoxQty }}</em> }
                </span>
              }
            </td>
            <td class="ix-right ix-nowrap">{{ i.TotalUnits | number }}<div class="ix-xs">{{ i.TotalBoxes }} box</div></td>
            <td class="ix-nowrap">
              @if (isOpen(i)) {
                <div class="ix-progress" [class.done]="i.Status === 'Dispatched'"><div [style.width.%]="percent(i)"></div></div>
                <div class="ix-xs">{{ i.DispatchedBoxes }} / {{ i.TotalBoxes }} sent
                  @if (i.Status !== 'Dispatched' && i.ExpectedDispatchDate) { · by {{ i.ExpectedDispatchDate | date:'dd MMM' }} }</div>
              } @else { <span class="ix-xs">—</span> }
            </td>
            <td><span class="ix-status" [ngClass]="statusClass(i.Status)">{{ i.Status }}</span></td>
            <td class="ix-right ix-nowrap" (click)="$event.stopPropagation()">
              @if (mode === 'press' && i.Status === 'Pending') {
                <button type="button" class="ix-btn green sm" (click)="emit(i, 'Approve')">Approve</button>
                <button type="button" class="ix-btn red sm" style="margin-left:6px" (click)="emit(i, 'Reject')">Reject</button>
              }
              @if (mode === 'press' && (i.Status === 'Approved' || i.Status === 'Partially Dispatched')) {
                <button type="button" class="ix-btn sm" (click)="emit(i, 'Dispatch')"><i class="fa fa-truck"></i> Dispatch</button>
              }
              @if (mode === 'creator' && i.Status === 'Pending') {
                <button type="button" class="ix-btn red sm" (click)="emit(i, 'Cancel')">Cancel</button>
              }
              <button type="button" class="ix-btn ghost sm" style="margin-left:6px" (click)="emit(i, 'View')">View</button>
            </td>
          </tr>
        } @empty {
          <tr><td colspan="7" style="text-align:center; padding:40px; color:#94a3b8;">No indents found.</td></tr>
        }
      }
    </tbody>
  </table>
</div>
`
})
export class IndentListComponent {
  @Input() indents: any[] = [];
  @Input() loading = false;
  /** 'creator' = Section (Cancel); 'press' = Nashik Admin (Approve / Reject / Dispatch); 'monitor' = view only */
  @Input() mode: 'creator' | 'press' | 'monitor' = 'monitor';
  @Output() action = new EventEmitter<{ indent: any; action: IndentAction }>();

  statusFilter = '';
  search = '';
  readonly statuses = ['Pending', 'Approved', 'Partially Dispatched', 'Dispatched', 'Rejected', 'Cancelled'];

  get filtered(): any[] {
    const q = this.search.trim().toLowerCase();
    return (this.indents || []).filter(i =>
      (!this.statusFilter || i.Status === this.statusFilter) &&
      (!q || String(i.IndentNo).toLowerCase().includes(q) ||
        (i.Items || []).some((x: any) => `${x.ComponentName} ${x.ComponentCode}`.toLowerCase().includes(q))));
  }

  count(status: string): number { return (this.indents || []).filter(i => i.Status === status).length; }
  isOpen(i: any): boolean { return ['Approved', 'Partially Dispatched', 'Dispatched'].includes(i.Status); }
  percent(i: any): number { return i.TotalBoxes ? Math.round((i.DispatchedBoxes / i.TotalBoxes) * 100) : 0; }
  statusClass(s: string): string { return indentStatusClass(s); }
  emit(indent: any, action: IndentAction): void { this.action.emit({ indent, action }); }
}

export function indentStatusClass(s: string): string {
  switch (s) {
    case 'Approved': return 'st-approved';
    case 'Partially Dispatched': return 'st-partial';
    case 'Dispatched': return 'st-done';
    case 'Rejected': return 'st-rejected';
    case 'Cancelled': return 'st-cancelled';
    default: return 'st-pending';
  }
}