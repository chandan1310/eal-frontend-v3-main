import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Wastage label workflow – backend: Controllers/WastageController.cs (api/Wastage). */
@Injectable({ providedIn: 'root' })
export class WastageService {
  private base = `${environment.apiBaseUrl}/Wastage`;

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('auth_token')}` });
  }

  private params(obj: Record<string, any>): HttpParams {
    let p = new HttpParams();
    Object.entries(obj).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v)); });
    return p;
  }

  /** Spools of my Issued applications. */
  getSpools(financialYear?: string, monthId?: string | number, search?: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/spools`, { headers: this.headers(), params: this.params({ financialYear, monthId, search }) });
  }

  submit(form: FormData): Observable<any> {
    return this.http.post(`${this.base}/submit`, form, { headers: this.headers() });   // browser sets multipart boundary
  }

  getMy(financialYear?: string, status?: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/my`, { headers: this.headers(), params: this.params({ financialYear, status }) });
  }

  getForReview(status = 'Submitted', financialYear?: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/review`, { headers: this.headers(), params: this.params({ status, financialYear }) });
  }

  review(id: string, action: 'Approve' | 'Reject', remark: string): Observable<any> {
    return this.http.post(`${this.base}/${id}/review`, { action, remark }, { headers: this.headers() });
  }

  /** Files need the token, so they are fetched as a blob and opened from an object URL. */
  openFile(id: string, kind: 'panchnama' | 'video'): void {
    const win = window.open('', '_blank');
    this.http.get(`${this.base}/${id}/file/${kind}`, { headers: this.headers(), responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        if (win) win.location.href = url; else window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => { win?.close(); alert('File not found.'); }
    });
  }
}

/** Same rules as the server: "1001-1010, 1015" → merged ranges + count, or an error. */
export function parseDamageNumbers(text: string, start?: number | null, end?: number | null):
  { ranges: [number, number][]; count: number; error: string } {
  const out = { ranges: [] as [number, number][], count: 0, error: '' };
  const parts = (text || '').split(/[,;\n]/).map(p => p.trim()).filter(Boolean);
  if (!parts.length) return out;
  for (const p of parts) {
    const ab = p.split(/[-–\s]+/).filter(Boolean);
    if (ab.length < 1 || ab.length > 2 || ab.some(x => !/^\d+$/.test(x) || +x <= 0)) { out.error = `"${p}" is not a label number or range.`; return out; }
    const a = +ab[0], b = ab.length === 2 ? +ab[1] : a;
    if (b < a) { out.error = `"${p}": end is smaller than start.`; return out; }
    if (start != null && end != null && (a < start || b > end)) { out.error = `${p} is outside this spool (${start} – ${end}).`; return out; }
    out.ranges.push([a, b]);
  }
  out.ranges.sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < out.ranges.length; i++)
    if (out.ranges[i][0] <= out.ranges[i - 1][1]) { out.error = `${out.ranges[i][0]} is entered twice.`; return out; }
  out.count = out.ranges.reduce((s, r) => s + (r[1] - r[0] + 1), 0);
  return out;
}

export function financialYearOptions(count = 3): string[] {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => `${y - i}-${y - i + 1}`);
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
