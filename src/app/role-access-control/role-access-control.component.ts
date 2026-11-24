import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { RoleManagementService } from '../services/role-management.service';
import { ToastService } from '../services/toast.service';
import { HoloserviceService } from '../services/holoservice.service';

@Component({
  selector: 'app-role-access-control',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './role-access-control.component.html'
})
export class RoleAccessControlComponent implements OnInit {
  activeTab: 'matrix' | 'masters' | 'users' = 'matrix';

  roles: any[] = [];
  pages: any[] = [];
  users: any[] = [];
  suppliers: any[] = [];
  districts: string[] = [];
  userTypes: string[] = [];
  currentFinancialYear = '';
  userSearch = '';

  // Tab 1: Matrix
  selectedRoleId: number | null = null;
  copySourceRoleId: number = 0;
  assignedPageIds: Set<number> = new Set<number>();
  /** Ticked pages in the order they appear in the side menu (first = top). Saved as Role_Page.Sort_Order. */
  menuOrder: number[] = [];
  dragIndex: number | null = null;
  savingMatrix = false;

  // Tab 2: Masters
  roleForm = { RoleId: 0, RoleName: '', Remarks: '', FinancialYear: '' };
  pageForm = { Page_Id: 0, Page_Url: '', Page_Name: '', Icon_Class: '' };

  // Tab 3: Unified Supplier + User Creation
  showCreateForm = false;
  linkToSupplier = true;
  isNewCompany = true;
  newUserForm: any = this.getEmptyUserForm();

  constructor(
    private roleService: RoleManagementService,
    private toastService: ToastService,
    private holoservice: HoloserviceService
  ) {}

  ngOnInit(): void {
    this.loadLookups();
    this.loadAllData();
  }

  getEmptyUserForm() {
    return {
      Username: '',
      Password: '',
      FirstName: '',
      LastName: '',
      Email: '',
      MobileNo: '',
      District: '',
      State: '',
      PIN: '',
      CompleteAddress: '',
      ModeOfTransport: '',
      Route: '',
      UserType: this.linkToSupplier ? 'FL' : '',
      RoleId: 0,
      ExistingSupplierId: 0,
      SupplierRegistrationNo: '',
      SupplierName: '',
      FinancialYear: this.currentFinancialYear
    };
  }

  loadLookups(): void {
    this.roleService.getLookups().subscribe(res => {
      this.currentFinancialYear = res.CurrentFinancialYear || '';
      this.districts = res.Districts || [];
      this.userTypes = res.UserTypes || [];
      this.roleForm.FinancialYear = this.currentFinancialYear;
      this.newUserForm.FinancialYear = this.currentFinancialYear;
    });
  }

  loadAllData(): void {
    this.roleService.getRoles().subscribe(res => {
      this.roles = res;
      if (this.roles.length > 0 && !this.selectedRoleId) {
        this.selectedRoleId = this.roles[0].RoleId;
        this.onRoleSelectForMatrix();
      }
    });

    this.roleService.getPages().subscribe(res => this.pages = res);
    this.roleService.getUsers().subscribe(res => this.users = res);
    this.roleService.getSuppliers().subscribe(res => this.suppliers = res);
  }

  // --- TAB 1: MATRIX ---
  onRoleSelectForMatrix(): void {
    if (!this.selectedRoleId) return;
    this.copySourceRoleId = 0;
    this.roleService.getRolePages(this.selectedRoleId).subscribe(ids => this.setAssigned(ids));
  }

  applyCopiedPermissions(): void {
    if (!this.copySourceRoleId || Number(this.copySourceRoleId) === 0) return;
    this.roleService.getRolePages(Number(this.copySourceRoleId)).subscribe(ids => {
      this.setAssigned(ids);
      this.toastService.show('Permissions copied successfully! Click Save to apply.', { class: 'success' });
    });
  }

  togglePageCheckbox(pageId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.addPage(pageId); else this.removePage(pageId);
  }

  togglePageCheckboxCard(pageId: number): void {
    if (this.assignedPageIds.has(pageId)) this.removePage(pageId); else this.addPage(pageId);
  }

  // ---- menu order (ticked pages, top to bottom) ----
  private setAssigned(ids: number[]): void {
    const unique = (ids || []).map(Number).filter((id, i, all) => all.indexOf(id) === i);
    this.menuOrder = unique;
    this.assignedPageIds = new Set(unique);
  }

  private addPage(pageId: number): void {
    if (this.assignedPageIds.has(pageId)) return;
    this.assignedPageIds.add(pageId);
    this.menuOrder = [...this.menuOrder, pageId];          // new ticks go to the bottom of the menu
  }

  private removePage(pageId: number): void {
    this.assignedPageIds.delete(pageId);
    this.menuOrder = this.menuOrder.filter(id => id !== pageId);
  }

  pageById(id: number): any {
    return this.pages.find(p => Number(p.Page_Id) === Number(id)) || { Page_Id: id, Page_Name: 'Page ' + id };
  }

  moveMenu(index: number, step: number): void {
    const to = index + step;
    if (to < 0 || to >= this.menuOrder.length) return;
    const list = [...this.menuOrder];
    [list[index], list[to]] = [list[to], list[index]];
    this.menuOrder = list;
  }

  onMenuDragStart(index: number): void { this.dragIndex = index; }

  onMenuDragOver(event: DragEvent): void { event.preventDefault(); }

  onMenuDrop(index: number): void {
    if (this.dragIndex === null || this.dragIndex === index) { this.dragIndex = null; return; }
    const list = [...this.menuOrder];
    const [moved] = list.splice(this.dragIndex, 1);
    list.splice(index, 0, moved);
    this.menuOrder = list;
    this.dragIndex = null;
  }

  saveMatrixPermissions(): void {
    if (!this.selectedRoleId) return;
    this.savingMatrix = true;
    this.roleService.assignPages({
      roleId: Number(this.selectedRoleId),
      pageIds: [...this.menuOrder],          // order = side-menu order
      financialYear: this.currentFinancialYear
    }).subscribe({
      next: (res: any) => {
        this.savingMatrix = false;
        this.toastService.show(res?.message || 'Role permissions updated successfully!', { class: 'success' });
        // reload: the server keeps Role & Access Control / Approval Workflow for admin roles
        if (this.selectedRoleId) this.roleService.getRolePages(this.selectedRoleId).subscribe(ids => this.setAssigned(ids));
        this.holoservice.triggerMenuRefresh();
      },
      error: () => {
        this.savingMatrix = false;
        this.toastService.show('Error updating permissions.', { class: 'danger' });
      }
    });
  }

  // --- TAB 2: MASTERS ---
  submitRole(): void {
    if (!this.roleForm.RoleName.trim()) return;
    this.roleForm.FinancialYear = this.currentFinancialYear;
    this.roleService.saveRole(this.roleForm).subscribe({
      next: () => {
        this.toastService.show('Role saved!', { class: 'success' });
        this.roleForm = { RoleId: 0, RoleName: '', Remarks: '', FinancialYear: this.currentFinancialYear };
        this.loadAllData();
      },
      error: () => this.toastService.show('Failed to save role.', { class: 'danger' })
    });
  }

  editRole(role: any): void {
    this.roleForm = { ...role };
  }

  deleteRole(role: any): void {
    if (!confirm(`Are you sure you want to delete role "${role.RoleName}"?`)) return;
    this.roleService.deleteRole(role.RoleId).subscribe({
      next: (res) => {
        this.toastService.show(res.message || 'Role deleted!', { class: 'success' });
        if (this.selectedRoleId === role.RoleId) this.selectedRoleId = null;
        this.loadAllData();
        this.holoservice.triggerMenuRefresh();
      },
      error: (err) => this.toastService.show(err.error?.message || 'Failed to delete role.', { class: 'danger' })
    });
  }

  submitPage(): void {
    if (!this.pageForm.Page_Name.trim() || !this.pageForm.Page_Url.trim()) return;
    this.roleService.savePage(this.pageForm).subscribe({
      next: () => {
        this.toastService.show('Menu page saved!', { class: 'success' });
        this.pageForm = { Page_Id: 0, Page_Url: '', Page_Name: '', Icon_Class: '' };
        this.loadAllData();
        this.holoservice.triggerMenuRefresh();
      },
      error: () => this.toastService.show('Failed to save page.', { class: 'danger' })
    });
  }

  editPage(page: any): void {
    this.pageForm = { ...page };
  }

  deletePage(page: any): void {
    if (!confirm(`Are you sure you want to delete page "${page.Page_Name}"?`)) return;
    this.roleService.deletePage(page.Page_Id).subscribe({
      next: (res) => {
        this.toastService.show(res.message || 'Page deleted!', { class: 'success' });
        this.loadAllData();
        this.onRoleSelectForMatrix();
        this.holoservice.triggerMenuRefresh();
      },
      error: (err) => this.toastService.show(err.error?.message || 'Failed to delete page.', { class: 'danger' })
    });
  }

  // --- TAB 3: USERS & SUPPLIERS ---
  openCreateDepartmentUser(): void {
    this.showCreateForm = true;
    this.linkToSupplier = false;
    this.newUserForm = this.getEmptyUserForm();
  }

  onSupplierToggleChange(): void {
    if (this.linkToSupplier) {
      this.newUserForm.UserType = 'FL';
    } else {
      this.newUserForm.ExistingSupplierId = 0;
      this.newUserForm.SupplierName = '';
      this.newUserForm.SupplierRegistrationNo = '';
      const selectedRole = this.roles.find(r => r.RoleId == Number(this.newUserForm.RoleId));
      this.newUserForm.UserType = selectedRole ? selectedRole.RoleName : '';
    }
  }

  onNewUserRoleChange(): void {
    const selectedRole = this.roles.find(r => r.RoleId == Number(this.newUserForm.RoleId));
    if (!this.linkToSupplier && selectedRole) {
      this.newUserForm.UserType = selectedRole.RoleName;
    } else if (this.linkToSupplier && !this.newUserForm.UserType) {
      this.newUserForm.UserType = 'FL';
    }
  }

  get filteredUsers(): any[] {
    if (!this.userSearch.trim()) return this.users;
    const term = this.userSearch.toLowerCase();
    return this.users.filter(u =>
      u.Username?.toLowerCase().includes(term) ||
      u.FullName?.toLowerCase().includes(term) ||
      u.District?.toLowerCase().includes(term) ||
      u.SupplierName?.toLowerCase().includes(term) ||
      u.RoleName?.toLowerCase().includes(term)
    );
  }

  submitNewUser(): void {
    if (!this.newUserForm.Username.trim() || !this.newUserForm.Password.trim() || !this.newUserForm.RoleId) {
      this.toastService.show('Username, Password, aur Role bharna zaroori hai!', { class: 'danger' });
      return;
    }

    if (this.linkToSupplier && this.isNewCompany && !this.newUserForm.SupplierName.trim()) {
      this.toastService.show('Supplier / Company Name bharna zaroori hai!', { class: 'danger' });
      return;
    }

    if (this.linkToSupplier && !this.isNewCompany && (!this.newUserForm.ExistingSupplierId || Number(this.newUserForm.ExistingSupplierId) === 0)) {
      this.toastService.show('Existing Supplier select karein ya New Supplier par switch karein!', { class: 'danger' });
      return;
    }

    const selectedRole = this.roles.find(r => r.RoleId == Number(this.newUserForm.RoleId));
    const resolvedUserType = this.linkToSupplier
      ? (this.newUserForm.UserType?.trim() || 'FL')
      : (this.newUserForm.UserType?.trim() || selectedRole?.RoleName || '');

    const payload = {
      ...this.newUserForm,
      UserType: resolvedUserType,
      RoleId: Number(this.newUserForm.RoleId),
      IsSupplier: this.linkToSupplier,
      ExistingSupplierId: (this.linkToSupplier && !this.isNewCompany) ? Number(this.newUserForm.ExistingSupplierId) : null,
      FinancialYear: this.currentFinancialYear
    };

    this.roleService.createUser(payload).subscribe({
      next: (res) => {
        this.toastService.show(res.message || 'User created successfully!', { class: 'success' });
        this.showCreateForm = false;
        this.linkToSupplier = true;
        this.isNewCompany = true;
        this.userSearch = '';
        this.newUserForm = this.getEmptyUserForm();
        this.loadAllData();
        this.loadLookups();
      },
      error: (err) => {
        const msg = err.error?.error || err.error?.message || 'Failed to create user.';
        this.toastService.show(msg, { class: 'danger' });
      }
    });
  }

  deleteUser(user: any): void {
    if (!confirm(`Are you sure you want to delete user "${user.Username}"?`)) return;
    this.roleService.deleteUser(user.UserId).subscribe({
      next: (res) => {
        this.toastService.show(res.message || 'User deleted!', { class: 'success' });
        this.loadAllData();
      },
      error: (err) => {
        const msg = err.error?.message || 'Failed to delete user.';
        this.toastService.show(msg, { class: 'danger' });
      }
    });
  }

  changeUserRole(user: any): void {
    this.roleService.updateUserRole({
      userId: user.UserId,
      roleId: Number(user.RoleId)
    }).subscribe({
      next: () => {
        this.toastService.show(`Role updated for ${user.Username}`, { class: 'success' });
        this.loadAllData();
        this.holoservice.triggerMenuRefresh();
      },
      error: () => this.toastService.show('Failed to update user role.', { class: 'danger' })
    });
  }

  toggleStatus(user: any): void {
    this.roleService.toggleUserStatus(user.UserId).subscribe({
      next: () => {
        this.toastService.show(`Status updated for ${user.Username}`, { class: 'success' });
        this.loadAllData();
      }
    });
  }

  toggleCreateSupplierForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (this.showCreateForm) {
      this.linkToSupplier = true;
      this.newUserForm = this.getEmptyUserForm();
    }
  }

  promptResetPassword(user: any): void {
    const newPass = prompt(`Enter new password for "${user.Username}":`);
    if (newPass && newPass.trim().length >= 4) {
      this.roleService.resetUserPassword({
        userId: user.UserId,
        newPassword: newPass.trim()
      }).subscribe({
        next: () => this.toastService.show('Password reset successfully!', { class: 'success' }),
        error: (err) => {
          console.error('Reset error details:', err);
          this.toastService.show('Failed to reset password.', { class: 'danger' });
        }
      });
    }
  }
}