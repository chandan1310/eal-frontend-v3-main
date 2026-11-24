import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { WastageService, parseDamageNumbers, financialYearOptions, MONTHS } from '../services/wastage.service';

/**
 * Wastage Label (supplier / bar).
 *  Tab 1 "Report Wastage": spools of my Issued applications → Report → damaged numbers + Panchnama (+ video) → Submit.
 *  Tab 2 "My Submissions": every entry with its status (Submitted / Approved / Rejected) and the reviewer's remark.
 */
@Component({
  selector: 'app-wastage-lable',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './wastage-lable.component.html',
  styleUrls: ['./wastage-lable.component.css']
})
export class WastageLableComponent implements OnInit {
  readonly months = MONTHS;
  readonly fyOptions = financialYearOptions();
  readonly reasons = ['Torn / damaged while applying', 'Misprint', 'Smudged / unreadable', 'Damaged in transit', 'Other'];

  tab: 'report' | 'mine' = 'report';
  fy = this.fyOptions[0];
  monthId = '';
  search = '';

  spools: any[] = [];
  mine: any[] = [];
  mineStatus = 'All';
  loadingSpools = false;
  loadingMine = false;
  error = '';
  toast = '';

  // report panel
  selected: any = null;
  numbers = '';
  reason = this.reasons[0];
  reasonText = '';
  panchnama: File | null = null;
  video: File | null = null;
  saving = false;
  formError = '';

  constructor(private api: WastageService) {}

  ngOnInit(): void {
    this.loadSpools();
    this.loadMine();
  }

  loadSpools(): void {
    this.loadingSpools = true;
    this.error = '';
    this.api.getSpools(this.fy, this.monthId, this.search.trim()).subscribe({
      next: res => { this.spools = res || []; this.loadingSpools = false; },
      error: err => { this.error = err?.error?.message || 'Could not load spools.'; this.loadingSpools = false; }
    });
  }

  loadMine(): void {
    this.loadingMine = true;
    this.api.getMy(this.fy).subscribe({
      next: res => { this.mine = res || []; this.loadingMine = false; },
      error: () => { this.mine = []; this.loadingMine = false; }
    });
  }

  applyFilter(): void { this.loadSpools(); this.loadMine(); }

  get mineFiltered(): any[] {
    return this.mineStatus === 'All' ? this.mine : this.mine.filter(m => m.status === this.mineStatus);
  }
  countMine(status: string): number { return this.mine.filter(m => m.status === status).length; }
  get approvedLabels(): number {
    return this.mine.filter(m => m.status === 'Approved').reduce((s, m) => s + (+m.damageCount || 0), 0);
  }

  // ---------------- report panel
  open(s: any): void {
    this.selected = s;
    this.numbers = '';
    this.reason = this.reasons[0];
    this.reasonText = '';
    this.panchnama = null;
    this.video = null;
    this.formError = '';
  }
  close(): void { if (!this.saving) this.selected = null; }

  get parsed() { return parseDamageNumbers(this.numbers, this.selected?.startNo, this.selected?.endNo); }

  onFile(ev: Event, kind: 'panchnama' | 'video'): void {
    const f = (ev.target as HTMLInputElement).files?.[0] || null;
    this.formError = '';
    if (!f) { this[kind] = null; return; }
    const ext = f.name.toLowerCase().split('.').pop() || '';
    const ok = kind === 'panchnama' ? ['pdf', 'jpg', 'jpeg', 'png'] : ['mp4', 'webm'];
    const max = kind === 'panchnama' ? 5 : 50;
    if (!ok.includes(ext)) { this.formError = `${kind === 'panchnama' ? 'Panchnama' : 'Video'} must be ${ok.join(', ').toUpperCase()}.`; (ev.target as HTMLInputElement).value = ''; return; }
    if (f.size > max * 1024 * 1024) { this.formError = `File must be smaller than ${max} MB.`; (ev.target as HTMLInputElement).value = ''; return; }
    this[kind] = f;
  }

  get canSubmit(): boolean {
    const p = this.parsed;
    return !!this.selected && p.count > 0 && !p.error && !!this.panchnama && !this.saving &&
      (this.reason !== 'Other' || this.reasonText.trim().length > 2);
  }

  submit(): void {
    if (!this.canSubmit) return;
    const fd = new FormData();
    fd.append('SpoolId', String(this.selected.spoolId));
    fd.append('DamageNumbers', this.numbers);
    fd.append('Reason', this.reason === 'Other' ? this.reasonText.trim() : this.reason + (this.reasonText.trim() ? ` – ${this.reasonText.trim()}` : ''));
    fd.append('Panchnama', this.panchnama!);
    if (this.video) fd.append('Video', this.video);

    this.saving = true;
    this.formError = '';
    this.api.submit(fd).subscribe({
      next: res => {
        this.saving = false;
        this.selected = null;
        this.showToast(res?.message || 'Submitted for review.');
        this.loadSpools();
        this.loadMine();
      },
      error: err => {
        this.saving = false;
        this.formError = err?.status === 413 ? 'Files are too large.' : (err?.error?.message || 'Could not submit. Please try again.');
      }
    });
  }

  view(m: any, kind: 'panchnama' | 'video'): void { this.api.openFile(m.id, kind); }

  private showToast(msg: string): void {
    this.toast = msg;
    setTimeout(() => (this.toast = ''), 4000);
  }

  badge(status: string): string {
    return status === 'Approved' ? 'st-approved' : status === 'Rejected' ? 'st-rejected' : 'st-pending';
  }
}
