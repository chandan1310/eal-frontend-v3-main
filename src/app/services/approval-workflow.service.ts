import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, map, catchError, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Dashboard tabs. First / middle levels: Pending · Approved · Rejected.
 * Final level: Pending · Permit Generate & Digital Sign · Issued · Rejected.
 * Which tabs a level gets is decided by the API from the level's position (Level.Tabs).
 */
export type WorkflowTab = 'Pending' | 'Approved' | 'Rejected' | 'PermitDsc' | 'Issued';

export const WORKFLOW_TAB_LABELS: Record<WorkflowTab, string> = {
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  PermitDsc: 'Permit Generate & Digital Sign',
  Issued: 'Issued'
};

/** Derived by the API from the level's position in the active sequence – never from its name. */
export type WorkflowResponsibility = 'FIRST' | 'MIDDLE' | 'FINAL';

export interface WorkflowLevelActions {
  CanAssignLabels: boolean;
  CanApprove: boolean;
  CanReject: boolean;
  RemarksMandatoryOnApprove: boolean;
  RemarksMandatoryOnReject: boolean;
  CanDigitalSign: boolean;
  CanGeneratePermit: boolean;
}

export interface WorkflowLevelInfo {
  LevelId: number;
  LevelName: string;
  LevelCode: string;
  Position: number;
  IsDistrictScoped: boolean;
  IsFirst: boolean;
  IsFinal: boolean;
  IsMine: boolean;
  Responsibility?: WorkflowResponsibility;
  Tabs?: WorkflowTab[];
  Actions?: WorkflowLevelActions;
}

export interface WorkflowContext {
  WorkflowEnabled: boolean;
  /** Mapped to at least one active level → may open Check Demand Raise. */
  HasAccess: boolean;
  WorkflowName?: string;
  IsAdmin?: boolean;
  ApplicableUserTypes?: string[];
  Levels: WorkflowLevelInfo[];
  MyLevelIds: number[];
  CheckDemandPage?: { PageUrl: string; PageName: string; IconClass: string };
  Statuses?: {
    FinalApprovedStatusId: number;
    PermitGeneratedStatusId: number;
    IssuedStatusId: number;
    RejectedStatusId: number;
    EntryStatusIds: number[];
  };
}

export interface WorkflowQueueItem {
  AppId: number;
  AppStatus?: number;
  CurrentPosition?: number;
  CurrentStage?: string;
  LastActionBy?: string;
  LastActionDate?: string;
  LastActionAtLevel?: string;
  ActionByName?: string;
  ActionRemarks?: string;
  // Permit Generate & Digital Sign / Issued tabs
  DscCompleted?: boolean;
  PermitCompleted?: boolean;
  IsDscSigned?: boolean;
  DscSignerName?: string;
  DscSignedDate?: string;
  IssuePermitNo?: string;
  PermitCreateDate?: string;
  FinalApprovedDate?: string;
  FinalApprovedBy?: string;
}

/** Labels picked in the existing Assign Labels modal (sent with the first-level Accept). */
export interface WorkflowLabelAssignment {
  DetailId: number;
  EalTypeId: number;
  Ranges: { BoxNo?: string; SpoolId?: number; Start: number; End: number }[];
}

const DISABLED_CONTEXT: WorkflowContext = { WorkflowEnabled: false, HasAccess: false, Levels: [], MyLevelIds: [] };

@Injectable({ providedIn: 'root' })
export class ApprovalWorkflowService {
  private readonly baseUrl = `${environment.apiBaseUrl}/ApprovalWorkflow`;
  private context$?: Observable<WorkflowContext>;
  private contextToken = '';

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  private headers(): HttpHeaders {
    const token = isPlatformBrowser(this.platformId) ? (sessionStorage.getItem('auth_token') || '') : '';
    return new HttpHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
  }

  private unwrap<T>(obs: Observable<any>): Observable<T> {
    return obs.pipe(map((res: any) => (res?.data ?? res) as T));
  }

  // ------------------------------------------------------------------ runtime

  /**
   * The logged-in user's workflow context. Any failure (API not deployed, tables not installed,
   * network error) resolves to "workflow disabled" so the existing screens keep working.
   */
  getMyContext(forceReload = false): Observable<WorkflowContext> {
    if (!isPlatformBrowser(this.platformId)) return of(DISABLED_CONTEXT);
    // Cache per login: a different token (logout → login as another officer) reloads the context.
    const token = sessionStorage.getItem('auth_token') || '';
    if (token !== this.contextToken) { forceReload = true; this.contextToken = token; }
    if (!this.context$ || forceReload) {
      this.context$ = this.unwrap<WorkflowContext>(
        this.http.get(`${this.baseUrl}/my-context`, { headers: this.headers() })
      ).pipe(
        map(ctx => ({ ...DISABLED_CONTEXT, ...(ctx || {}) })),
        catchError(() => of(DISABLED_CONTEXT)),
        shareReplay(1)
      );
    }
    return this.context$;
  }

  clearContext(): void {
    this.context$ = undefined;
  }

  getQueue(stage: number | string, tab: WorkflowTab): Observable<{ LevelId: number; Tab: string; PreviousLevelName?: string; Items: WorkflowQueueItem[] }> {
    const params = new HttpParams().set('stage', String(stage)).set('tab', tab);
    return this.unwrap(this.http.get(`${this.baseUrl}/queue`, { headers: this.headers(), params }));
  }

  getApplicationWorkflow(appId: number): Observable<any> {
    return this.unwrap(this.http.get(`${this.baseUrl}/application/${appId}`, { headers: this.headers() }));
  }

  accept(payload: { AppId: number; LevelId: number; Remarks?: string; Labels?: WorkflowLabelAssignment[] }): Observable<any> {
    return this.http.post(`${this.baseUrl}/accept`, payload, { headers: this.headers() });
  }

  reject(payload: { AppId: number; LevelId: number; Remarks: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/reject`, payload, { headers: this.headers() });
  }

  /** Final level, step 2 – the API refuses it until the Digital Sign (step 1) has been recorded. */
  generatePermit(payload: { AppId: number; Remarks?: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/generate-permit`, payload, { headers: this.headers() });
  }

  // ------------------------------------------------------------------ administration

  getConfig(): Observable<any> {
    return this.unwrap(this.http.get(`${this.baseUrl}/config`, { headers: this.headers() }));
  }

  saveConfig(payload: { WorkflowName?: string; ApplicableUserTypes?: string; IsActive: boolean }): Observable<any> {
    return this.http.put(`${this.baseUrl}/config`, payload, { headers: this.headers() });
  }

  createLevel(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/levels`, payload, { headers: this.headers() });
  }

  updateLevel(levelId: number, payload: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/levels/${levelId}`, payload, { headers: this.headers() });
  }

  reorderLevels(levelIds: number[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/levels/reorder`, { LevelIds: levelIds }, { headers: this.headers() });
  }

  deactivateLevel(levelId: number, moveToLevelId?: number | null): Observable<any> {
    return this.http.post(`${this.baseUrl}/levels/${levelId}/deactivate`, { MoveToLevelId: moveToLevelId ?? null }, { headers: this.headers() });
  }

  activateLevel(levelId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/levels/${levelId}/activate`, {}, { headers: this.headers() });
  }

  deleteLevel(levelId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/levels/${levelId}`, { headers: this.headers() });
  }

  getLevelUsers(levelId: number): Observable<any[]> {
    return this.unwrap<any[]>(this.http.get(`${this.baseUrl}/levels/${levelId}/users`, { headers: this.headers() }));
  }

  getMappableUsers(): Observable<any[]> {
    return this.unwrap<any[]>(this.http.get(`${this.baseUrl}/users`, { headers: this.headers() }));
  }

  saveMapping(levelId: number, userId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/mappings`, { LevelId: levelId, UserId: userId }, { headers: this.headers() });
  }

  toggleMapping(mappingId: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/mappings/${mappingId}/toggle`, {}, { headers: this.headers() });
  }
}
