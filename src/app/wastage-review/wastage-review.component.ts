import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { WastageService, financialYearOptions } from '../services/wastage.service';

/**
 * Wastage Review – Admin / Commissioner review FL & CL entries, District reviews Hotel/Bar entries of its district.
 * Approve → labels move to Destroy Label.  Reject → remark is required, supplier sees it in "My Submissions".
 */
@Component({
  selector: 'app-wastage-review',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  styleUrls: ['../wastage-lable/wastage-lable.component.css'],
  template: `
<div class="container-fluid p-0 wl-page min-vh-100">
  <div class="d-flex flex-nowrap m-0 p-0">
    <div class="sidebar-container bg-white shadow-sm flex-shrink-0" style="width: 260px; min-width: 260px;">
      <app-sidebar></app-sidebar>
    </div>

    <div class="flex-grow-1 px-4 py-4" style="min-width: 0;">
      <div class="d-flex justify-content-between align-items-end mb-3">
        <div>
          <h4 class="wl-title mb-1"><i class="fa fa-check-square-o me-2"></i>Wastage Review</h4>
          <div class="text-muted small">Check the damaged numbers and the Panchnama, then approve or reject. Approved labels go to Destroy Label.</div>
        </div>
        <select class="form-control form-control-sm" style="width: 140px;" [(ngModel)]="fy" (change)="load()">
          @for (f of fyOptions; track f) { <option [value]="f">{{ f }}</option> }
        </select>
      </div>

      <div class="card wl-card border-0">
        <div class="wl-head">
          <div class="wl-chips">
            @for (st of statuses; track st) {
              <button type="button" [class.active]="status === st" (click)="status = st; load()">{{ st === 'Submitted' ? 'Waiting' : st }}</button>
            }
          </div>
          <input type="search" class="form-control form-control-sm" style="width: 240px;" placeholder="Search application / company" [(ngModel)]="search" />
        </div>

        @if (error) { <div class="alert alert-danger m-3 py-2 small">{{ error }}</div> }

        <div class="table-responsive">
          <table class="table wl-table align-middle mb-0">
            <thead>
              <tr><th>Submitted</th><th>Company</th><th>Application / Spool</th><th>Damaged numbers</th>
                  <th class="text-end">Labels</th><th>Status</th><th class="text-end"></th></tr>
            </thead>
            <tbody>
              @if (loading) {
                <tr><td colspan="7" class="text-center text-muted py-5">Loading…</td></tr>
              } @else {
                @for (r of filtered; track r.id) {
                  <tr [class.sel]="selected?.id === r.id">
                    <td class="xs">{{ r.createdDate | date: 'dd MMM yyyy' }}<div class="text-muted">{{ r.submittedBy }}</div></td>
                    <td><div class="fw-semibold">{{ r.companyName }}</div>
                        <span class="wl-pill" [class.cl]="r.liquorType === 'CL'" [class.hb]="r.liquorType === 'HB'">{{ r.liquorName }}</span></td>
                    <td><div>{{ r.ealApplicationNo }}</div><div class="text-muted xs">{{ r.boxNo }} · Spool #{{ r.spoolId }}</div></td>
                    <td class="mono small">{{ r.damageNumbers }}</td>
                    <td class="text-end fw-semibold">{{ r.damageCount | number }}</td>
                    <td><span class="wl-status" [ngClass]="badge(r.status)">{{ r.status === 'Submitted' ? 'Waiting' : r.status }}</span></td>
                    <td class="text-end"><button class="btn btn-sm wl-btn-outline" (click)="open(r)">{{ r.status === 'Submitted' ? 'Review' : 'View' }}</button></td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="text-center text-muted py-5">
                    {{ status === 'Submitted' ? 'No wastage waiting for review.' : 'No entries.' }}
                  </td></tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>

@if (selected) {
  <div class="wl-backdrop" (click)="close()"></div>
  <aside class="wl-panel">
    <div class="wl-panel-head">
      <div>
        <div class="fw-bold">{{ selected.companyName }}</div>
        <div class="xs text-white-50">{{ selected.ealApplicationNo }} · {{ selected.boxNo }} · Spool #{{ selected.spoolId }}</div>
      </div>
      <button type="button" class="wl-x" (click)="close()" aria-label="Close">&times;</button>
    </div>
    <div class="wl-panel-body">
      <div class="wl-range">
        <div><span>Spool range</span><b class="mono">{{ selected.spoolStart }} – {{ selected.spoolEnd }}</b></div>
        <div><span>Damaged labels</span><b>{{ selected.damageCount | number }}</b></div>
      </div>
      <div class="mt-3"><div class="xs text-muted">Damaged numbers</div><div class="mono">{{ selected.damageNumbers }}</div></div>
      <div class="mt-3"><div class="xs text-muted">Reason</div><div>{{ selected.reason || '–' }}</div></div>
      <div class="mt-3"><div class="xs text-muted">Submitted</div><div>{{ selected.createdDate | date: 'dd MMM yyyy, h:mm a' }} by {{ selected.submittedBy }}</div></div>

      <div class="d-flex wl-gap mt-3">
        @if (selected.hasPanchnama) { <button class="btn btn-sm btn-outline-secondary" (click)="api.openFile(selected.id, 'panchnama')"><i class="fa fa-file-text-o me-1"></i>Open Panchnama</button> }
        @if (selected.hasVideo) { <button class="btn btn-sm btn-outline-secondary" (click)="api.openFile(selected.id, 'video')"><i class="fa fa-video-camera me-1"></i>Play video</button> }
      </div>

      @if (selected.status === 'Submitted') {
        <label class="form-label fw-semibold small mt-4">Remark <span class="text-muted fw-normal">(required to reject)</span></label>
        <textarea class="form-control" rows="3" maxlength="500" [(ngModel)]="remark" placeholder="e.g. Panchnama verified"></textarea>
      } @else {
        <div class="mt-4 p-3 rounded-3" [ngClass]="selected.status === 'Approved' ? 'wl-ok-box' : 'wl-bad-box'">
          <b>{{ selected.status }}</b> by {{ selected.reviewedBy || '–' }} on {{ selected.reviewedDate | date: 'dd MMM yyyy' }}
          @if (selected.reviewRemark) { <div class="small mt-1">"{{ selected.reviewRemark }}"</div> }
        </div>
      }
      @if (formError) { <div class="alert alert-danger py-2 small mt-3 mb-0">{{ formError }}</div> }
    </div>
    @if (selected.status === 'Submitted') {
      <div class="wl-panel-foot">
        <button type="button" class="btn btn-outline-danger" [disabled]="saving" (click)="act('Reject')">Reject</button>
        <button type="button" class="btn btn-success" [disabled]="saving" (click)="act('Approve')">{{ saving ? 'Saving…' : 'Approve' }}</button>
      </div>
    }
  </aside>
}
@if (toast) { <div class="wl-toast"><i class="fa fa-check-circle me-2"></i>{{ toast }}</div> }
`
})
export class WastageReviewComponent implements OnInit {
  readonly fyOptions = financialYearOptions();
  readonly statuses = ['Submitted', 'Approved', 'Rejected', 'All'];
  fy = this.fyOptions[0];
  status = 'Submitted';
  search = '';
  rows: any[] = [];
  loading = false;
  error = '';
  selected: any = null;
  remark = '';
  saving = false;
  formError = '';
  toast = '';

  constructor(public api: WastageService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getForReview(this.status, this.fy).subscribe({
      next: res => { this.rows = res || []; this.loading = false; },
      error: err => { this.rows = []; this.loading = false; this.error = err?.error?.message || 'Could not load entries.'; }
    });
  }

  get filtered(): any[] {
    const q = this.search.trim().toLowerCase();
    return !q ? this.rows : this.rows.filter(r =>
      (r.ealApplicationNo || '').toLowerCase().includes(q) || (r.companyName || '').toLowerCase().includes(q));
  }

  open(r: any): void { this.selected = r; this.remark = ''; this.formError = ''; }
  close(): void { if (!this.saving) this.selected = null; }

  act(action: 'Approve' | 'Reject'): void {
    if (action === 'Reject' && this.remark.trim().length < 3) { this.formError = 'Please write the reason for rejection.'; return; }
    this.saving = true;
    this.formError = '';
    this.api.review(this.selected.id, action, this.remark.trim()).subscribe({
      next: res => {
        this.saving = false;
        this.selected = null;
        this.toast = res?.message || 'Saved.';
        setTimeout(() => (this.toast = ''), 4000);
        this.load();
      },
      error: err => { this.saving = false; this.formError = err?.error?.message || 'Could not save.'; }
    });
  }

  badge(status: string): string {
    return status === 'Approved' ? 'st-approved' : status === 'Rejected' ? 'st-rejected' : 'st-pending';
  }
}
