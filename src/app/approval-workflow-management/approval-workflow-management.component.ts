import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ToastService } from '../services/toast.service';
import { ApprovalWorkflowService } from '../services/approval-workflow.service';

interface LevelForm {
  LevelId: number;
  LevelName: string;
  Sequence: number | null;
  IsDistrictScoped: boolean;
}

/**
 * Approval Workflow – one simple screen:
 *  1. switch the workflow ON / OFF,
 *  2. list the levels in order (move up / down, add, rename, pause, delete),
 *  3. add / remove the users who work at each level, right in the level's row.
 * What each level does (assign labels / review / final + DSC + permit) follows from its position automatically.
 */
@Component({
  selector: 'app-approval-workflow-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './approval-workflow-management.component.html',
  styleUrl: './approval-workflow-management.component.css'
})
export class ApprovalWorkflowManagementComponent implements OnInit {
  loading = false;
  saving = false;
  accessDenied = '';

  config: any = null;
  levels: any[] = [];
  officers: any[] = [];
  allUsers: any[] = [];
  minimumActiveLevels = 2;

  // workflow switch
  workflowOn = false;
  userTypes: string[] = [];
  readonly knownUserTypes = ['FL', 'CL', 'HB'];

  // add / edit level
  showLevelForm = false;
  levelForm: LevelForm = this.emptyForm();

  // per-row helpers
  userToAdd: Record<number, number | null> = {};
  deleteConfirmId: number | null = null;
  deactivatePrompt: { level: any; pendingCount: number; moveToLevelId: number | null } | null = null;
  showInactive = false;

  constructor(
    private wf: ApprovalWorkflowService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.load();
    this.wf.getMappableUsers().subscribe({
      next: (users) => { this.allUsers = users || []; this.cdr.detectChanges(); },
      error: () => { }
    });
  }

  load(): void {
    this.loading = true;
    this.wf.getConfig().subscribe({
      next: (res: any) => {
        this.config = res?.Config || null;
        this.levels = res?.Levels || [];
        this.officers = res?.Officers || [];
        this.minimumActiveLevels = res?.MinimumActiveLevels || 2;
        this.workflowOn = !!this.config?.IsActive;
        this.userTypes = [...(this.config?.ApplicableUserTypes || [])];
        this.loading = false;
        this.accessDenied = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.accessDenied = err?.error?.message || 'Unable to load the approval workflow configuration.';
        this.cdr.detectChanges();
      }
    });
  }

  // ------------------------------------------------------------------ view helpers

  get activeLevels(): any[] {
    return this.levels.filter(l => l.IsActive).sort((a, b) => a.Sequence - b.Sequence);
  }

  get inactiveLevels(): any[] {
    return this.levels.filter(l => !l.IsActive);
  }

  get flowPreview(): string[] {
    return [...this.activeLevels.map(l => l.LevelName), 'Digital Sign', 'Generate Permit', 'Issued'];
  }

  get levelsWithoutUsers(): any[] {
    return this.activeLevels.filter(l => this.officersOf(l).length === 0);
  }

  get levelsWithoutUsersText(): string {
    return this.levelsWithoutUsers.map(l => l.LevelName).join(', ');
  }

  get canRemoveActiveLevel(): boolean {
    return this.activeLevels.length > this.minimumActiveLevels;
  }

  get userTypeOptions(): string[] {
    return Array.from(new Set([...this.knownUserTypes, ...(this.config?.ApplicableUserTypes || [])]));
  }

  /** FIRST / MIDDLE / FINAL – sent by the API (derived from position); fallback for older APIs. */
  responsibilityOf(level: any): 'FIRST' | 'MIDDLE' | 'FINAL' | null {
    if (!level?.IsActive) return null;
    if (level.Responsibility) return level.Responsibility;
    return level.IsFirst ? 'FIRST' : level.IsFinal ? 'FINAL' : 'MIDDLE';
  }

  officersOf(level: any): any[] {
    return this.officers.filter(o => Number(o.LevelId) === Number(level.LevelId));
  }

  private levelNameOfUser(userId: number): string | null {
    const o = this.officers.find(x => x.Source === 'Mapping' && Number(x.UserId) === Number(userId));
    if (!o) return null;
    return this.levels.find(l => Number(l.LevelId) === Number(o.LevelId))?.LevelName || null;
  }

  /** Department users that can be added to this level (supplier / licensee logins are hidden). */
  candidatesFor(level: any): Array<{ userId: number; label: string }> {
    const here = new Set(this.officersOf(level).map(o => Number(o.UserId)));
    return this.allUsers
      .filter(u => !u.IsSupplierLogin && !here.has(Number(u.UserId)))
      .sort((a, b) => String(a.Username || '').localeCompare(String(b.Username || '')))
      .map(u => {
        const name = String(u.FullName || '').trim();
        const uname = String(u.Username || '').trim();
        const other = this.levelNameOfUser(u.UserId);
        return {
          userId: Number(u.UserId),
          label: `${name && name.toLowerCase() !== uname.toLowerCase() ? name + ' (' + uname + ')' : uname}`
            + `${u.RoleName ? ' — ' + u.RoleName : ''}${other ? '  [now in ' + other + ']' : ''}`
        };
      });
  }

  // ------------------------------------------------------------------ workflow ON / OFF

  toggleUserType(t: string, checked: boolean): void {
    const set = new Set(this.userTypes);
    checked ? set.add(t) : set.delete(t);
    this.userTypes = Array.from(set);
  }

  get settingsChanged(): boolean {
    const saved = [...(this.config?.ApplicableUserTypes || [])].sort().join(',');
    return this.workflowOn !== !!this.config?.IsActive || [...this.userTypes].sort().join(',') !== saved;
  }

  saveWorkflowSettings(): void {
    if (!this.userTypes.length) {
      this.toast.show('Select at least one application type (FL / CL / HB).', { class: 'danger' });
      return;
    }
    if (this.workflowOn && this.levelsWithoutUsers.length) {
      this.toast.show(`Add a user to: ${this.levelsWithoutUsersText} before switching the workflow ON.`, { class: 'danger' });
      return;
    }
    this.saving = true;
    this.wf.saveConfig({
      WorkflowName: this.config?.WorkflowName,
      ApplicableUserTypes: this.userTypes.join(','),
      IsActive: this.workflowOn
    }).subscribe({
      next: (res: any) => this.done(res, 'Saved.'),
      error: (err) => { this.workflowOn = !!this.config?.IsActive; this.fail(err, 'Unable to save.'); }
    });
  }

  // ------------------------------------------------------------------ levels

  private emptyForm(): LevelForm {
    return { LevelId: 0, LevelName: '', Sequence: null, IsDistrictScoped: false };
  }

  positionOptions(): number[] {
    const editingActive = !!this.levelForm.LevelId && !!this.levels.find(l => l.LevelId === this.levelForm.LevelId && l.IsActive);
    const n = this.activeLevels.length + (editingActive ? 0 : 1);
    return Array.from({ length: Math.max(n, 1) }, (_, i) => i + 1);
  }

  openAddLevel(): void {
    this.levelForm = { ...this.emptyForm(), Sequence: this.activeLevels.length + 1 };
    this.showLevelForm = true;
  }

  openEditLevel(level: any): void {
    this.levelForm = {
      LevelId: level.LevelId,
      LevelName: level.LevelName,
      Sequence: level.IsActive ? level.Sequence : null,
      IsDistrictScoped: !!level.IsDistrictScoped
    };
    this.showLevelForm = true;
  }

  saveLevel(): void {
    const f = this.levelForm;
    if (!f.LevelName?.trim()) {
      this.toast.show('Enter the level name.', { class: 'danger' });
      return;
    }
    const existing = this.levels.find(l => l.LevelId === f.LevelId);
    const payload = {
      LevelName: f.LevelName.trim(),
      LevelCode: existing?.LevelCode || null,        // unchanged; generated from the name for new levels
      Sequence: f.Sequence ? Number(f.Sequence) : null,
      RoleId: existing?.RoleId ?? null,              // role links are not edited here any more – users are added per level
      IsDistrictScoped: f.IsDistrictScoped,
      IsActive: existing ? !!existing.IsActive : true
    };
    this.saving = true;
    const call$ = f.LevelId ? this.wf.updateLevel(f.LevelId, payload) : this.wf.createLevel(payload);
    call$.subscribe({
      next: (res: any) => { this.showLevelForm = false; this.done(res, 'Level saved.'); },
      error: (err) => this.fail(err, 'Unable to save the level.')
    });
  }

  /** Move a level up / down – saved immediately. */
  move(level: any, delta: number): void {
    const ids = this.activeLevels.map(l => Number(l.LevelId));
    const i = ids.indexOf(Number(level.LevelId));
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    this.saving = true;
    this.wf.reorderLevels(ids).subscribe({
      next: (res: any) => this.done(res, 'Order updated.'),
      error: (err) => this.fail(err, 'Unable to change the order.')
    });
  }

  requestDeactivate(level: any): void {
    this.deactivatePrompt = null;
    this.saving = true;
    this.wf.deactivateLevel(level.LevelId).subscribe({
      next: (res: any) => this.done(res, 'Level paused.'),
      error: (err) => {
        this.saving = false;
        if (err?.status === 409 && err?.error?.data?.PendingCount) {
          this.deactivatePrompt = { level, pendingCount: err.error.data.PendingCount, moveToLevelId: null };
          this.cdr.detectChanges();
          return;
        }
        this.fail(err, 'Unable to pause the level.');
      }
    });
  }

  moveTargets(level: any): any[] {
    return this.activeLevels.filter(l => l.LevelId !== level?.LevelId);
  }

  confirmDeactivateWithMove(): void {
    const p = this.deactivatePrompt;
    if (!p?.moveToLevelId) {
      this.toast.show('Choose where the pending applications should go.', { class: 'danger' });
      return;
    }
    this.saving = true;
    this.wf.deactivateLevel(p.level.LevelId, Number(p.moveToLevelId)).subscribe({
      next: (res: any) => { this.deactivatePrompt = null; this.done(res, 'Level paused.'); },
      error: (err) => this.fail(err, 'Unable to pause the level.')
    });
  }

  activate(level: any): void {
    this.saving = true;
    this.wf.activateLevel(level.LevelId).subscribe({
      next: (res: any) => this.done(res, 'Level activated.'),
      error: (err) => this.fail(err, 'Unable to activate the level.')
    });
  }

  confirmDelete(level: any): void {
    this.saving = true;
    this.wf.deleteLevel(level.LevelId).subscribe({
      next: (res: any) => { this.deleteConfirmId = null; this.done(res, 'Level deleted.'); },
      error: (err) => { this.deleteConfirmId = null; this.fail(err, 'Unable to delete the level.'); }
    });
  }

  // ------------------------------------------------------------------ users per level

  addUser(level: any): void {
    const userId = this.userToAdd[level.LevelId];
    if (!userId) return;
    this.saving = true;
    this.wf.saveMapping(Number(level.LevelId), Number(userId)).subscribe({
      next: (res: any) => { this.userToAdd[level.LevelId] = null; this.done(res, 'User added.'); },
      error: (err) => this.fail(err, 'Unable to add the user.')
    });
  }

  removeUser(officer: any): void {
    if (!officer?.MappingId) return;
    this.saving = true;
    this.wf.toggleMapping(Number(officer.MappingId)).subscribe({   // active → inactive = removed from the level
      next: () => this.done({ message: `${officer.FullName || officer.Username} removed from the level.` }, 'User removed.'),
      error: (err) => this.fail(err, 'Unable to remove the user.')
    });
  }

  // ------------------------------------------------------------------ common

  private done(res: any, fallback: string): void {
    this.saving = false;
    this.toast.show(res?.message || fallback, { class: 'success' });
    this.wf.clearContext();
    this.load();
  }

  private fail(err: any, fallback: string): void {
    this.saving = false;
    this.toast.show(err?.error?.message || fallback, { class: 'danger' });
    this.cdr.detectChanges();
  }
}
