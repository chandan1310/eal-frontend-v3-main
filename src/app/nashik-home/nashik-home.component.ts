import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StockService } from '../services/stock.service';
import { IndentDetailComponent } from '../shared/indent-detail.component';

/**
 * Home page for the Nashik Admin (label press). Shown inside Home instead of the office stock dashboard.
 * Only press work: indents to approve, boxes to send, late dispatches, dispatch per EAL type, recent DCs.
 * Data: GET api/Indent/press-dashboard. Styles: shared/indent-ui.css + the "nh-" rules below.
 */
@Component({
  selector: 'app-nashik-home',
  standalone: true,
  imports: [CommonModule, IndentDetailComponent],
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['../shared/indent-ui.css'],
  styles: [`
.nh-wrap { padding: 4px 0 24px; }
.nh-hello { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.nh-hello h4 { margin: 0; color: #0f2c59; font-weight: 700; font-size: 1.45rem; }
.nh-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
.nh-kpi { background: #fff; border: 1px solid #edf0f5; border-radius: 14px; padding: 16px 18px; box-shadow: 0 1px 2px rgba(15, 44, 89, .05); position: relative; overflow: hidden; }
.nh-kpi::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--nh, #1f4f8b); }
.nh-kpi .lbl { font-size: .78rem; color: #64748b; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.nh-kpi .lbl i { width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: var(--nh-bg, #e8eef8); color: var(--nh, #1f4f8b); }
.nh-kpi .val { font-size: 1.9rem; font-weight: 700; color: #0f172a; margin-top: 8px; line-height: 1; }
.nh-kpi .val small { font-size: .85rem; color: #64748b; font-weight: 600; margin-left: 4px; }
.nh-kpi .foot { font-size: .76rem; color: #64748b; margin-top: 6px; }
.nh-kpi.amber { --nh: #d97706; --nh-bg: #fef3c7; } .nh-kpi.blue { --nh: #1f4f8b; --nh-bg: #dbeafe; }
.nh-kpi.red { --nh: #dc2626; --nh-bg: #fee2e2; } .nh-kpi.green { --nh: #15803d; --nh-bg: #dcfce7; }
.nh-kpi.red.zero { --nh: #94a3b8; --nh-bg: #f1f5f9; }
.nh-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; }
.nh-grid .ix-card { margin-bottom: 0; }
.nh-grid + .nh-grid { margin-top: 18px; }
.nh-task { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
.nh-task:last-child { border-bottom: 0; }
.nh-task:hover { background: #f8fbff; }
.nh-task .no { font-weight: 700; color: #0f2c59; min-width: 52px; }
.nh-task .mid { flex: 1; min-width: 0; }
.nh-task .mid .ix-item { margin-bottom: 2px; }
.nh-empty { padding: 30px 18px; text-align: center; color: #94a3b8; font-size: .86rem; }
.nh-empty i { display: block; font-size: 1.6rem; color: #cbd5e1; margin-bottom: 6px; }
.nh-age { font-size: .72rem; font-weight: 600; color: #92400e; background: #fef3c7; border-radius: 10px; padding: 1px 8px; white-space: nowrap; }
.nh-age.old { color: #991b1b; background: #fee2e2; }
.nh-bar { height: 8px; background: #eef2f7; border-radius: 6px; overflow: hidden; }
.nh-bar div { height: 100%; background: linear-gradient(90deg, #1f4f8b, #3b74c4); border-radius: 6px; }
.nh-bar.done div { background: #15803d; }
.nh-chart { display: flex; align-items: flex-end; gap: 14px; height: 170px; padding: 10px 6px 0; }
.nh-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 6px; }
.nh-col .b { width: 100%; max-width: 46px; background: #c7d7f0; border-radius: 6px 6px 2px 2px; min-height: 3px; transition: height .3s; }
.nh-col.cur .b { background: #1f4f8b; }
.nh-col .n { font-size: .78rem; font-weight: 700; color: #0f2c59; }
.nh-col .m { font-size: .72rem; color: #64748b; }
@media (max-width: 1200px) { .nh-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .nh-grid { grid-template-columns: 1fr; } }
`],
  template: `
<div class="nh-wrap ix-page" style="background:transparent">
  <div class="nh-hello">
    <div>
      <h4>Nashik Press · Dashboard</h4>
      <div class="ix-sub">Indents from the Excise office and label boxes dispatched against them · FY {{ d?.FinancialYear }}</div>
    </div>
    <div class="ix-row">
      <button type="button" class="ix-btn ghost" (click)="load()"><i class="fa fa-refresh"></i> Refresh</button>
      <button type="button" class="ix-btn" (click)="go('indent-request')"><i class="fa fa-list-alt"></i> All indent requests</button>
    </div>
  </div>

  @if (error) { <div class="ix-note red ix-mb">{{ error }}</div> }

  <!-- KPIs -->
  <div class="nh-kpis">
    <div class="nh-kpi amber">
      <div class="lbl"><i class="fa fa-hourglass-half"></i> Waiting for your approval</div>
      <div class="val">{{ k?.PendingApproval ?? '–' }} <small>indents</small></div>
      <div class="foot">
        @if (k?.UrgentPending) { <span class="ix-urgent" style="margin-left:0">{{ k.UrgentPending }} URGENT</span> }
        @if (k?.PendingApproval) { oldest {{ k.OldestPendingDays }} day(s) } @else { nothing pending }
      </div>
    </div>
    <div class="nh-kpi blue">
      <div class="lbl"><i class="fa fa-truck"></i> Boxes to dispatch</div>
      <div class="val">{{ k?.BoxesToSend ?? '–' }} <small>box</small></div>
      <div class="foot">{{ k?.OpenIndents ?? 0 }} approved indent(s) · {{ (k?.BoxesToSend || 0) * labelsPerBox | number }} labels</div>
    </div>
    <div class="nh-kpi red" [class.zero]="!k?.Overdue">
      <div class="lbl"><i class="fa fa-exclamation-triangle"></i> Late dispatch</div>
      <div class="val">{{ k?.Overdue ?? '–' }} <small>indents</small></div>
      <div class="foot">@if (k?.Overdue) { {{ k.OverdueBoxes }} box past the promised date } @else { all on time }</div>
    </div>
    <div class="nh-kpi green">
      <div class="lbl"><i class="fa fa-check-circle"></i> Dispatched this month</div>
      <div class="val">{{ k?.DispatchedThisMonth ?? '–' }} <small>box</small></div>
      <div class="foot">{{ k?.DispatchedThisFy ?? 0 }} box this FY · {{ k?.CompletedThisFy ?? 0 }} indent(s) completed</div>
    </div>
  </div>

  <!-- action queues -->
  <div class="nh-grid">
    <div class="ix-card">
      <div class="ix-card-head"><h5><i class="fa fa-inbox"></i> Approve next</h5><span class="ix-xs">urgent first, then oldest</span></div>
      @for (i of d?.ToApprove || []; track i.IndentNo) {
        <div class="nh-task" (click)="viewNo = i.IndentNo">
          <div class="no">#{{ i.IndentNo }}@if (i.Priority === 'Urgent') { <div><span class="ix-urgent" style="margin-left:0">URGENT</span></div> }</div>
          <div class="mid">
            @for (x of i.Items; track $index) { <span class="ix-item"><b>{{ x.ComponentCode }}</b><span class="ix-item-name">{{ x.ComponentName }}</span><em>{{ x.BoxQty }}</em></span> }
            <div class="ix-xs">{{ i.RequestedBoxes }} box · period {{ i.StartDate | date:'dd MMM' }} – {{ i.EndDate | date:'dd MMM' }} · by {{ i.CreatedByName || 'Section' }}</div>
          </div>
          <span class="nh-age" [class.old]="i.AgeDays > 3">{{ i.AgeDays === 0 ? 'today' : i.AgeDays + 'd ago' }}</span>
          <button type="button" class="ix-btn green sm" (click)="$event.stopPropagation(); go('indent-request')">Review</button>
        </div>
      } @empty {
        <div class="nh-empty"><i class="fa fa-check-circle-o"></i>No indent is waiting for approval.</div>
      }
    </div>

    <div class="ix-card">
      <div class="ix-card-head"><h5><i class="fa fa-truck"></i> Dispatch next</h5><span class="ix-xs">by promised date</span></div>
      @for (i of d?.ToDispatch || []; track i.IndentNo) {
        <div class="nh-task" (click)="viewNo = i.IndentNo">
          <div class="no">#{{ i.IndentNo }}@if (i.Priority === 'Urgent') { <div><span class="ix-urgent" style="margin-left:0">URGENT</span></div> }</div>
          <div class="mid">
            @for (x of i.Items; track $index) { <span class="ix-item"><b>{{ x.ComponentCode }}</b><span class="ix-item-name">{{ x.ComponentName }}</span><em>{{ x.BalanceBoxes }}</em></span> }
            <div class="ix-row" style="gap:8px; margin-top:3px">
              <div class="nh-bar" style="width:120px"><div [style.width.%]="i.TotalBoxes ? i.DispatchedBoxes * 100 / i.TotalBoxes : 0"></div></div>
              <span class="ix-xs">{{ i.DispatchedBoxes }} / {{ i.TotalBoxes }} sent</span>
            </div>
          </div>
          @if (i.ExpectedDispatchDate) {
            <span class="nh-age" [class.old]="i.IsOverdue">{{ i.IsOverdue ? 'late · ' : 'by ' }}{{ i.ExpectedDispatchDate | date:'dd MMM' }}</span>
          }
          <button type="button" class="ix-btn sm" (click)="$event.stopPropagation(); dispatch(i.IndentNo)"><i class="fa fa-truck"></i> Dispatch</button>
        </div>
      } @empty {
        <div class="nh-empty"><i class="fa fa-cube"></i>No approved indent is waiting for boxes.</div>
      }
    </div>
  </div>

  <!-- per type + monthly -->
  <div class="nh-grid">
    <div class="ix-card">
      <div class="ix-card-head"><h5><i class="fa fa-th-large"></i> EAL types · FY {{ d?.FinancialYear }}</h5><span class="ix-xs">approved indents</span></div>
      <div class="ix-card-body" style="padding-top:8px">
        <table class="ix-table">
          <thead><tr><th>EAL type</th><th class="ix-right">Approved</th><th class="ix-right">Sent</th><th style="width:30%">Progress</th><th class="ix-right">To send</th></tr></thead>
          <tbody>
            @for (t of d?.ByType || []; track t.EALTypeId) {
              <tr>
                <td><div class="ix-type"><span class="ix-code">{{ t.Code }}</span><div><b>{{ t.Name }}</b><div class="ix-xs">{{ t.Type }}</div></div></div></td>
                <td class="ix-right">{{ t.ApprovedBoxes }}</td>
                <td class="ix-right">{{ t.SentBoxes }}</td>
                <td><div class="nh-bar" [class.done]="t.ApprovedBoxes && !t.BalanceBoxes"><div [style.width.%]="t.ApprovedBoxes ? t.SentBoxes * 100 / t.ApprovedBoxes : 0"></div></div></td>
                <td class="ix-right"><b>{{ t.BalanceBoxes }}</b>@if (t.WaitingApprovalBoxes) { <div class="ix-xs">+{{ t.WaitingApprovalBoxes }} pending</div> }</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <div class="ix-card">
      <div class="ix-card-head"><h5><i class="fa fa-bar-chart"></i> Boxes dispatched</h5><span class="ix-xs">last 6 months</span></div>
      <div class="ix-card-body">
        <div class="nh-chart">
          @for (m of d?.Monthly || []; track $index; let last = $last) {
            <div class="nh-col" [class.cur]="last">
              <span class="n">{{ m.Boxes }}</span>
              <div class="b" [style.height.%]="maxMonthly ? m.Boxes * 82 / maxMonthly : 0"></div>
              <span class="m">{{ monthName(m.Month) }}</span>
            </div>
          }
        </div>
        <div class="ix-xs" style="margin-top:10px">1 box = {{ labelsPerBox | number }} labels. Counts every box entered in Stock Entry.</div>
      </div>
    </div>
  </div>

  <!-- recent dispatches -->
  <div class="ix-card ix-mt">
    <div class="ix-card-head"><h5><i class="fa fa-file-text-o"></i> Recent dispatches</h5>
      <button type="button" class="ix-btn ghost sm" (click)="go('stockentry')">Open Stock Entry</button></div>
    <div class="ix-card-body" style="padding-top:8px">
      <table class="ix-table">
        <thead><tr><th>Date</th><th>DC no.</th><th>Indent</th><th>EAL type · boxes</th><th class="ix-right">Boxes</th><th class="ix-right">Labels</th></tr></thead>
        <tbody>
          @for (r of d?.RecentDispatches || []; track $index) {
            <tr [class.ix-click]="r.IndentNo" (click)="r.IndentNo && (viewNo = r.IndentNo)">
              <td class="ix-nowrap">{{ r.Date | date:'dd MMM yyyy' }}</td>
              <td class="ix-mono">{{ r.DcNo || '—' }}</td>
              <td>@if (r.IndentNo) { <b>#{{ r.IndentNo }}</b> } @else { <span class="ix-xs">without indent</span> }</td>
              <td>@for (t of r.Types; track $index) { <span class="ix-item"><span class="ix-item-name">{{ t.Name }}</span><em>{{ t.Boxes }}</em></span> }</td>
              <td class="ix-right"><b>{{ r.Boxes }}</b></td>
              <td class="ix-right">{{ r.Labels | number }}</td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="nh-empty">No dispatch entered yet.</td></tr>
          }
        </tbody>
      </table>
    </div>
  </div>
</div>

<app-indent-detail [indentNo]="viewNo" (closed)="viewNo = null"></app-indent-detail>
`
})
export class NashikHomeComponent implements OnInit {
  d: any = null;
  error = '';
  viewNo: string | null = null;
  private readonly months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  constructor(private stock: StockService, private router: Router) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.error = '';
    this.stock.pressDashboard().subscribe({
      next: res => this.d = res,
      error: err => this.error = err?.error?.message || 'Could not load the dashboard.'
    });
  }

  get k(): any { return this.d?.Kpi; }
  get labelsPerBox(): number { return this.d?.LabelsPerBox || 90000; }
  get maxMonthly(): number { return Math.max(0, ...((this.d?.Monthly || []).map((m: any) => m.Boxes))); }
  monthName(m: number): string { return this.months[(m || 1) - 1]; }

  /** Pages in this login's menu (route names differ in case: indent-Request, nashik-stockentry …). */
  private route(name: string): string {
    let allowed: string[] = [];
    try { allowed = JSON.parse(sessionStorage.getItem('allowed_routes') || '[]'); } catch { allowed = []; }
    const clean = allowed.map(u => (u || '').replace(/^\/+/, ''));
    if (name === 'stockentry') return clean.find(u => ['stockentry', 'nashik-stockentry'].includes(u.toLowerCase())) || 'stockentry';
    return clean.find(u => u.toLowerCase() === name.toLowerCase()) || (name === 'indent-request' ? 'indent-Request' : name);
  }

  go(name: string): void { this.router.navigate(['/' + this.route(name)]); }
  dispatch(indentNo: string): void { this.router.navigate(['/' + this.route('stockentry')], { queryParams: { indent: indentNo } }); }
}