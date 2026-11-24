import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { Subscription } from 'rxjs';
import { HoloserviceService } from '../services/holoservice.service';
import { ApprovalWorkflowService } from '../services/approval-workflow.service';
import { CHECK_DEMAND_ROUTE } from '../guards/landing-route';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit, OnDestroy {
  role: string | null = null;
  userType: string | null = null;
  roleId: number | null = null;
  isMenuOpen: boolean = false;
  isLoggingOut = false;

  menuList: any[] = [];
  private menuSub?: Subscription;

  constructor(
    private routes: Router,
    private holoservice: HoloserviceService,
    private approvalWorkflowService: ApprovalWorkflowService
  ) { }

  ngOnInit(): void {
    this.getUserDetailsAndMenus();
    this.menuSub = this.holoservice.menuRefresh$.subscribe(() => {
      this.getUserDetailsAndMenus();
    });
  }

  ngOnDestroy(): void {
    this.menuSub?.unsubscribe();
  }

  getUserDetailsAndMenus() {
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      try {
        const decodedToken: any = jwtDecode(token);
        console.log('Decoded Token Payload:', decodedToken);

        this.role = decodedToken.Role?.trim();
        this.userType = decodedToken.UserType?.trim();

        let parsedRoleId = Number(decodedToken.RoleId || decodedToken.roleId);

        if (isNaN(parsedRoleId) || parsedRoleId <= 0) {
          if (this.role === 'Admin') parsedRoleId = 1;
          else if (this.role === 'District') parsedRoleId = 2;
          else if (this.role === 'User' || this.role === 'Supplier') parsedRoleId = 3;
          else parsedRoleId = 1;
        }

        this.roleId = parsedRoleId;
        this.fetchDynamicMenus(this.roleId);
      } catch (error) {
        console.error('Error decoding token', error);
      }
    }
  }

  fetchDynamicMenus(roleId: number) {
    if (!roleId || isNaN(roleId)) {
      console.warn('Skipping menu fetch due to invalid roleId:', roleId);
      return;
    }

    this.holoservice.getDynamicMenus(roleId).subscribe({
      next: (res) => {
        this.menuList = res;
        const allowedRoutes = res.map((m: any) => m.PageUrl);
        sessionStorage.setItem('allowed_routes', JSON.stringify(allowedRoutes));
        this.leaveHomeIfNotAllowed();
        this.applyApprovalWorkflowAccess();
      },
      error: (err) => {
        console.error('Failed to load dynamic menus', err);
      }
    });
  }

  private applyApprovalWorkflowAccess(): void {
    this.approvalWorkflowService.getMyContext().subscribe(ctx => {
      if (!ctx?.WorkflowEnabled) return;
      const page = ctx.CheckDemandPage || { PageUrl: 'officeapplication', PageName: 'Check Demand Raise', IconClass: 'fa-check-square-o' };
      const norm = (u: string) => (u || '').trim().replace(/^\/+/, '').toLowerCase();
      const isPage = (m: any) => norm(m.PageUrl) === norm(page.PageUrl);

      if (ctx.HasAccess && !this.menuList.some(isPage)) {
        this.menuList = [...this.menuList, { PageName: page.PageName, PageUrl: page.PageUrl, IconClass: page.IconClass }];
      } else if (!ctx.HasAccess && !ctx.IsAdmin) {   // never take a ticked menu away from an admin-type role
        this.menuList = this.menuList.filter(m => !isPage(m));
      }
      sessionStorage.setItem('allowed_routes', JSON.stringify(this.menuList.map((m: any) => m.PageUrl)));
      this.leaveHomeIfNotAllowed();
    });
  }

  /** Approval-level officers who still reach /home (old bookmark, back button) go to Check Demand Raise. */
  private leaveHomeIfNotAllowed(): void {
    const onHome = this.routes.url.split('?')[0].replace(/^\/+/, '').toLowerCase() === 'home';
    if (onHome && !this.showHome) this.routes.navigate(['/' + CHECK_DEMAND_ROUTE]);
  }

  /** Approval-level officers (role whose only menu is Check Demand Raise) get no Home item. */
  get showHome(): boolean {
    const norm = (u: any) => String(u || '').trim().replace(/^\/+/, '').toLowerCase();
    return !(this.menuList.length > 0 && this.menuList.every((m: any) => norm(m.PageUrl) === 'officeapplication'));
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  onLogOutClick() {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;

    this.holoservice.logout().subscribe({
      next: () => {
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('allowed_routes');
        this.routes.navigateByUrl('login');
      },
      error: (err) => {
        console.error('Logout failed', err);
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('allowed_routes');
        this.routes.navigateByUrl('login');
      },
      complete: () => {
        this.isLoggingOut = false;
      }
    });
  }

  onNavigation(path: string) {
    // "Apply New Application" can be stored under different page URLs (applicationform, cl, fl, flcl, …):
    // always open the form that matches the login's licence type (UserType FL / CL / FL+CL).
    const clean = (path || '').trim().replace(/^\/+/, '').toLowerCase();
    const isApplyPage = /^(applicationform|application-form|applicationform-?(fl|cl|flcl)|applicationfrom-?(fl|cl|clfl|flcl)|fl|cl|flcl|clfl)$/.test(clean);

    if (isApplyPage) {
      // Hotel / Bar and District logins have their own forms (no purchase order)
      const r = (this.role || '').trim().toLowerCase();
      if (r === 'bar') { this.routes.navigateByUrl('ApplicationformDistrictBar'); return; }
      if (r === 'district') { this.routes.navigateByUrl('ApplicationformDistrict'); return; }

      const t = (this.userType || '').trim().toUpperCase().replace(/\s+/g, '');
      if (t === 'CL') { this.routes.navigateByUrl('cl'); return; }
      if (t === 'FL') { this.routes.navigateByUrl('fl'); return; }
      if (t === 'FL/CL' || t === 'CL/FL' || t === 'FLCL' || t === 'CLFL' || t === 'FL,CL' || t === 'BOTH') {
        this.routes.navigateByUrl('flcl'); return;
      }
      if (t === 'HB' || t === 'BAR' || t === 'HOTEL/BAR' || t === 'HOTELBAR') { this.routes.navigateByUrl('ApplicationformDistrictBar'); return; }
      if (t === 'DISTRICT') { this.routes.navigateByUrl('ApplicationformDistrict'); return; }
      // unknown licence type: open the page exactly as stored in the menu
      this.routes.navigateByUrl(path);
      return;
    }

    this.routes.navigateByUrl(path);
  }
}