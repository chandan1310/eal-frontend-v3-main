import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { StockService } from '../services/stock.service';
import { ToastService } from '../services/toast.service';
import { IndentDetailComponent } from '../shared/indent-detail.component';

interface DispatchRow {
  EALTypeId: number; Code: string; Name: string; Type: string;
  Approved: number; Sent: number; Balance: number;
  qty: number;
  // preview
  firstBox?: number; lastBox?: number; firstSerial?: number; lastSerial?: number;
}

/**
 * Nashik dispatch (the "Create New Stock Entry" tab of Stock Entry).
 *   1. pick an approved indent  → one row per EAL type that still has boxes to send (pre-filled with the balance)
 *   2. DC no., date, place, pack size
 *   3. box numbers and label serials are shown before saving (next free numbers)
 *   4. Save → POST Stock/createStock: one box per entry, 9 spools each, counted against the indent.
 * Manage Existing DC stays in the parent component.
 */
@Component({
  selector: 'app-dispatch-entry',
  standalone: true,
  imports: [CommonModule, FormsModule, IndentDetailComponent],
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['../shared/indent-ui.css'],
  styles: [`
.de-wrap { font-variant-numeric: tabular-nums; color: #1e293b; }
.de-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.de-head h5 { margin: 0; font-weight: 700; color: #0f2c59; font-size: 1.05rem; }
.de-table-wrap { border: 1px solid #e5e9f0; border-radius: 12px; overflow: hidden; background: #fff; }
.de-table-wrap .ix-table td { padding: 14px 14px; }
.de-left { display: flex; flex-wrap: wrap; gap: 6px; }
.de-done { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.de-empty { text-align: center; padding: 50px 20px; color: #64748b; }
.de-empty i { font-size: 2rem; color: #cbd5e1; display: block; margin-bottom: 8px; }
/* modal */
.de-modal { width: min(760px, 95vw) !important; }
.de-fields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.de-wrap .form-control, .de-modal .form-control { border-color: #d6dde8; border-radius: 8px; font-size: .9rem; height: 38px; }
.de-modal .form-control:focus { border-color: #1f4f8b; box-shadow: 0 0 0 3px rgba(31, 79, 139, .15); }
.de-modal .form-control.bad { border-color: #dc2626; }
.de-sum { background: #f4f7fc; border-radius: 10px; padding: 12px 14px; margin-top: 14px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: .84rem; }
.de-sum b { color: #0f2c59; font-size: 1.05rem; }
.de-err { color: #b91c1c; font-size: .8rem; margin-top: 10px; }
@media (max-width: 800px) { .de-fields { grid-template-columns: 1fr 1fr; } }
`],
  template: `
<div class="de-wrap">
  @if (lastSaved) {
    <div class="de-done">
      <div><b style="color:#166534"><i class="fa fa-check-circle"></i> {{ lastSaved.boxes }} box saved on DC {{ lastSaved.dc }}</b>
        <div class="ix-xs">Indent #{{ lastSaved.indent }} · box no. {{ lastSaved.firstBox }} – {{ lastSaved.lastBox }}</div></div>
      <div class="ix-row">
        <button type="button" class="ix-btn ghost sm" (click)="viewNo = lastSaved.indent">View indent</button>
        <button type="button" class="ix-x" (click)="lastSaved = null">&times;</button>
      </div>
    </div>
  }

  <div class="de-head">
    <div>
      <h5>Approved indents to dispatch</h5>
      <div class="ix-xs">Click <b>Dispatch</b> on an indent, enter the DC details and how many boxes you are sending.</div>
    </div>
    <button type="button" class="ix-btn ghost sm" (click)="loadIndents()"><i class="fa fa-refresh"></i> Refresh</button>
  </div>

  <div class="de-table-wrap">
    <table class="ix-table">
      <thead><tr><th>Indent</th><th>Boxes left to send</th><th>Sent</th><th>Promised by</th><th class="ix-right"></th></tr></thead>
      <tbody>
        @if (loadingIndents) {
          <tr><td colspan="5" class="de-empty">Loading…</td></tr>
        } @else {
          @for (i of openIndents; track i.IndentNo) {
            <tr>
              <td class="ix-nowrap">
                <b>#{{ i.IndentNo }}</b>@if (i.Priority === 'Urgent') { <span class="ix-urgent">URGENT</span> }
                <div class="ix-xs">{{ i.CreatedDate | date:'dd MMM yyyy' }}</div>
              </td>
              <td>
                <div class="de-left">
                  @for (x of leftItems(i); track x.IndentId) {
                    <span class="ix-item"><b>{{ x.ComponentCode }}</b><span class="ix-item-name">{{ x.ComponentName }}</span><em>{{ x.BalanceBoxes }}</em></span>
                  }
                </div>
                <div class="ix-xs">{{ i.BalanceBoxes }} box · {{ i.BalanceBoxes * 90000 | number }} labels</div>
              </td>
              <td class="ix-nowrap">
                <div class="ix-progress"><div [style.width.%]="i.TotalBoxes ? i.DispatchedBoxes * 100 / i.TotalBoxes : 0"></div></div>
                <div class="ix-xs">{{ i.DispatchedBoxes }} / {{ i.TotalBoxes }}</div>
              </td>
              <td class="ix-nowrap">
                @if (i.ExpectedDispatchDate) {
                  <span [style.color]="isLate(i) ? '#b91c1c' : ''">{{ i.ExpectedDispatchDate | date:'dd MMM yyyy' }}</span>
                  @if (isLate(i)) { <div class="ix-xs" style="color:#b91c1c">late</div> }
                } @else { <span class="ix-xs">—</span> }
              </td>
              <td class="ix-right ix-nowrap">
                <button type="button" class="ix-btn ghost sm" (click)="viewNo = i.IndentNo">View</button>
                <button type="button" class="ix-btn" style="margin-left:6px" (click)="open(i.IndentNo)"><i class="fa fa-truck"></i> Dispatch</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="de-empty"><i class="fa fa-inbox"></i>No approved indent is waiting.<br /><span class="ix-xs">Approve an indent on <b>Indent Request</b> first.</span></td></tr>
          }
        }
      </tbody>
    </table>
  </div>
</div>

<!-- ============ dispatch modal ============ -->
@if (modalOpen && indent) {
  <div class="ix-backdrop" (click)="close()"></div>
  <div class="ix-dialog de-modal">
    <div class="ix-dialog-head">
      <h6><i class="fa fa-truck"></i> Dispatch · Indent #{{ indent.IndentNo }} @if (indent.Priority === 'Urgent') { <span class="ix-urgent">URGENT</span> }</h6>
      <button type="button" class="ix-x" (click)="close()">&times;</button>
    </div>

    <div class="ix-dialog-body">
      <div class="de-fields">
        <div>
          <label class="ix-label">DC no. <span class="text-danger">*</span></label>
          <input class="form-control" [(ngModel)]="dcNo" maxlength="30" placeholder="DC/NSK/2240" [class.bad]="dcNo && !dcOk" />
        </div>
        <div>
          <label class="ix-label">Dispatch date <span class="text-danger">*</span></label>
          <input type="date" class="form-control" [(ngModel)]="entryDate" [max]="today" />
        </div>
        <div>
          <label class="ix-label">Place from <span class="text-danger">*</span></label>
          <select class="form-control" [(ngModel)]="placeId">
            @for (p of places; track p.Place_Id) { <option [value]="p.Place_Id">{{ p.Place_Name }}</option> }
          </select>
        </div>
        <div>
          <label class="ix-label">Pack size <span class="text-danger">*</span></label>
          <select class="form-control" [(ngModel)]="packSizeId" (ngModelChange)="refreshPreview()" [class.bad]="!packSizeId">
            <option value="">Select</option>
            @for (p of packSizes; track p.packsizeId) { <option [value]="p.packsizeId">{{ p.packsizeType }}</option> }
          </select>
        </div>
      </div>

      <table class="ix-table" style="border:1px solid #e5e9f0; border-radius:10px; border-collapse:separate; border-spacing:0; overflow:hidden">
        <thead><tr><th>EAL type</th><th class="ix-right">Left</th><th style="width:150px">Send now</th><th>Box no.</th></tr></thead>
        <tbody>
          @for (r of rows; track r.EALTypeId) {
            <tr>
              <td><div class="ix-type"><span class="ix-code">{{ r.Code }}</span><div><b>{{ r.Name }}</b><div class="ix-xs">{{ r.Type }}</div></div></div></td>
              <td class="ix-right"><b>{{ r.Balance }}</b></td>
              <td>
                @if (r.Balance > 0) {
                  <div class="ix-stepper" [class.has]="r.qty > 0">
                    <button type="button" (click)="setQty(r, r.qty - 1)">−</button>
                    <input type="number" min="0" [max]="r.Balance" [ngModel]="r.qty" (ngModelChange)="setQty(r, $event)" />
                    <button type="button" (click)="setQty(r, r.qty + 1)">+</button>
                  </div>
                } @else { <span class="ix-status st-done">Done</span> }
              </td>
              <td class="ix-mono ix-xs">@if (r.qty && r.firstBox) { {{ r.firstBox }}@if (r.lastBox !== r.firstBox) { – {{ r.lastBox }} } } @else { — }</td>
            </tr>
          }
        </tbody>
      </table>

      <div class="de-sum">
        <div><b>{{ totalQty }} box</b> · {{ totalQty * labelsPerBox | number }} labels</div>
        @if (totalQty && preview) {
          <div class="ix-xs">Box no. <span class="ix-mono">{{ preview.firstBox }} – {{ preview.firstBox + totalQty - 1 }}</span>
            · Serials <span class="ix-mono">{{ preview.firstSerial }} – {{ preview.firstSerial + totalQty * labelsPerBox - 1 }}</span></div>
        }
      </div>

      <div class="ix-mt">
        <label class="ix-label">Remark (optional)</label>
        <input class="form-control" [(ngModel)]="remark" maxlength="100" placeholder="e.g. Vehicle MH15 AB 1234" />
      </div>

      @if (problem) { <div class="de-err"><i class="fa fa-exclamation-circle"></i> {{ problem }}</div> }
    </div>

    <div class="ix-dialog-foot">
      <button type="button" class="ix-btn ghost" (click)="fillAll()">Send all</button>
      <span style="flex:1"></span>
      <button type="button" class="ix-btn ghost" (click)="close()" [disabled]="saving">Cancel</button>
      <button type="button" class="ix-btn green" (click)="save()" [disabled]="!canSave">{{ saving ? 'Saving…' : 'Save dispatch' }}</button>
    </div>
  </div>
}

<app-indent-detail [indentNo]="viewNo" (closed)="viewNo = null"></app-indent-detail>
`
})
export class DispatchEntryComponent implements OnInit {
  readonly labelsPerSpool = 10000;
  today = this.iso(new Date());
  fy = '';

  openIndents: any[] = [];
  loadingIndents = false;
  indentNo = '';
  rows: DispatchRow[] = [];

  places: any[] = [];
  packSizes: any[] = [];
  dcNo = '';
  entryDate = this.today;
  placeId = '';
  packSizeId = '';
  remark = '';

  preview: { firstBox: number; firstSerial: number } | null = null;
  modalOpen = false;
  saving = false;
  lastSaved: any = null;
  viewNo: string | null = null;

  constructor(private stock: StockService, private toast: ToastService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const d = new Date();
    const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    this.fy = `${y}-${y + 1}`;
    this.loadIndents(this.route.snapshot.queryParamMap.get('indent') || '');  // ?indent=013 opens its dispatch form
    this.stock.placefrom().subscribe({
      next: (p: any[]) => {
        this.places = p || [];
        const nashik = this.places.find(x => /nashik|nasik/i.test(x.Place_Name || ''));
        this.placeId = String((nashik || this.places[0])?.Place_Id ?? '');
      }
    });
    this.stock.getPackSizes().subscribe({
      next: (p: any[]) => {
        this.packSizes = p || [];
        // a box holds 9 spools (90,000 labels); pre-select only a pack size that matches, otherwise the user picks
        const nine = this.packSizes.find(x => Number(x.NoOfBottles) === 9);
        this.packSizeId = nine ? String(nine.packsizeId) : (this.packSizes.length === 1 ? String(this.packSizes[0].packsizeId) : '');
      }
    });
  }

  private iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  loadIndents(select = ''): void {
    this.loadingIndents = true;
    this.stock.indentsOpenForDispatch().subscribe({
      next: list => {
        this.openIndents = Array.isArray(list) ? list : [];
        this.loadingIndents = false;
        if (select && this.openIndents.some(i => i.IndentNo === select)) this.open(select);
      },
      error: () => { this.openIndents = []; this.loadingIndents = false; }
    });
  }

  get indent(): any { return this.openIndents.find(i => i.IndentNo === this.indentNo) || null; }

  pick(no: string): void {
    this.indentNo = no;
    const ind = this.indent;
    this.rows = (ind?.Items || []).filter((x: any) => x.EALTypeId).map((x: any) => {
      const approved = x.ApprovedBoxQty ?? x.BoxQty;
      const sent = Math.min(x.DispatchedBoxes, approved);
      return {
        EALTypeId: Number(x.EALTypeId), Code: x.ComponentCode, Name: x.ComponentName, Type: x.ComponentType,
        Approved: approved, Sent: sent, Balance: x.BalanceBoxes, qty: x.BalanceBoxes
      } as DispatchRow;
    });
    this.refreshPreview();
  }

  open(no: string): void {
    this.pick(no);
    this.dcNo = ''; this.remark = '';
    this.entryDate = this.today;
    this.modalOpen = true;
  }
  close(): void { if (!this.saving) this.modalOpen = false; }
  leftItems(i: any): any[] { return (i.Items || []).filter((x: any) => x.BalanceBoxes > 0); }
  isLate(i: any): boolean { return !!i.ExpectedDispatchDate && String(i.ExpectedDispatchDate).slice(0, 10) < this.today; }

  // ---------- quantities
  setQty(r: DispatchRow, v: any): void {
    const n = Math.floor(Number(v));
    r.qty = isNaN(n) || n < 0 ? 0 : Math.min(n, r.Balance);
    this.refreshPreview();
  }
  fillAll(): void { this.rows.forEach(r => r.qty = r.Balance); this.refreshPreview(); }
  clearAll(): void { this.rows.forEach(r => r.qty = 0); this.refreshPreview(); }

  get chosen(): DispatchRow[] { return this.rows.filter(r => r.qty > 0); }
  get totalQty(): number { return this.rows.reduce((s, r) => s + (r.qty || 0), 0); }
  get pack(): any { return this.packSizes.find(p => String(p.packsizeId) === String(this.packSizeId)); }
  get spoolsPerBox(): number { return Number(this.pack?.NoOfBottles) || 9; }
  get labelsPerBox(): number { return this.spoolsPerBox * this.labelsPerSpool; }
  get placeName(): string { return this.places.find(p => String(p.Place_Id) === String(this.placeId))?.Place_Name || ''; }
  get dcOk(): boolean { return /^[A-Za-z0-9\/\-. ]{1,30}$/.test(this.dcNo.trim()); }

  get problem(): string {
    if (!this.indent || !this.totalQty) return '';
    if (!this.dcNo.trim()) return 'Enter the DC no.';
    if (!this.dcOk) return 'DC no. can have letters, numbers and / - . only.';
    if (!this.entryDate) return 'Select the dispatch date.';
    if (this.entryDate > this.today) return 'Dispatch date cannot be in the future.';
    if (!this.placeId) return 'Select place from.';
    if (!this.packSizeId) return 'Select the pack size.';
    return '';
  }
  get canSave(): boolean { return !!this.indent && this.totalQty > 0 && !this.problem && !!this.preview && !this.saving; }

  /** Next free box no. and serial (same numbering the API uses), then numbers per row. */
  refreshPreview(): void {
    this.stock.getBoxDetails(Math.max(1, this.totalQty)).subscribe({
      next: (res: any) => {
        this.preview = { firstBox: Number(res.startBoxNo), firstSerial: Number(res.lastSpoolEnd) + 1 };
        let box = this.preview.firstBox, serial = this.preview.firstSerial;
        for (const r of this.rows) {
          if (!r.qty) { r.firstBox = r.lastBox = r.firstSerial = r.lastSerial = undefined; continue; }
          r.firstBox = box; r.lastBox = box + r.qty - 1;
          r.firstSerial = serial; r.lastSerial = serial + r.qty * this.labelsPerBox - 1;
          box += r.qty; serial += r.qty * this.labelsPerBox;
        }
      },
      error: () => this.preview = null
    });
  }

  save(): void {
    if (!this.canSave || !this.preview) return;
    const data: any[] = [];
    for (const r of this.chosen) {
      for (let k = 0; k < r.qty; k++) {
        const boxNo = (r.firstBox ?? 0) + k;
        const from = (r.firstSerial ?? 0) + k * this.labelsPerBox;
        data.push({
          EALType: String(r.EALTypeId), selectedEalType: String(r.EALTypeId),
          BoxNo: String(boxNo), FromNo: from, FromTo: from + this.labelsPerBox - 1,
          Remark: this.remark.replace(/[<>]/g, '').trim(), PackSizeId: Number(this.packSizeId), SupplierId: 0
        });
      }
    }
    const payload = {
      type: 'new', FinancialYear: this.fy, EntryDate: this.entryDate, DC_No: this.dcNo.trim(),
      FromPlace: String(this.placeId), Month: Number(this.entryDate.slice(5, 7)), IndentNo: this.indentNo, data
    };
    const summary = { dc: this.dcNo.trim(), indent: this.indentNo, boxes: data.length, firstBox: data[0].BoxNo, lastBox: data[data.length - 1].BoxNo };

    this.saving = true;
    this.stock.createStock(payload).subscribe({
      next: (res: any) => {
        this.saving = false; this.modalOpen = false;
        this.toast.show(res?.message || 'Dispatch saved.', { class: 'success' });
        this.lastSaved = summary;
        this.dcNo = ''; this.remark = '';
        this.loadIndents();
      },
      error: (err: any) => {
        this.saving = false;
        this.toast.show(err?.error?.message || 'Could not save the dispatch.', { class: 'danger' });
        this.refreshPreview();
      }
    });
  }
}