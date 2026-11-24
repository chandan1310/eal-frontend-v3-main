import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { StockentryComponent } from './stockentry/stockentry.component';
import { HomeComponent } from './home/home.component';
import { ApplicationformflComponent } from './applicationform-fl/applicationform-fl.component';
import { OfficeapplicationComponent } from './officeapplication/officeapplication.component';
import { InventorydetailsComponent } from './inventorydetails/inventorydetails.component';
import { RoleGuard } from './guards/role.guard';
import { AuthGuard } from './guards/auth.guard';
import { UserTypeGuard } from './guards/user-type.guard';
import { ApplicationHistoryComponent } from './application-history/application-history.component';
import { OfficeApplicationDetailComponent } from './office-application-detail/office-application-detail.component';
import { ApplicationDetailComponent } from './application-detail/application-detail.component';
import { StockReportComponent } from './stock-report/stock-report.component';
import { StockLedgerComponent } from './stock-ledger/stock-ledger.component';
import { ApplicationfromClComponent } from './applicationfrom-cl/applicationfrom-cl.component';
import { WastageLableComponent } from './wastage-lable/wastage-lable.component';
import { DestroyLabelComponent } from './destroy-label/destroy-label.component';
import { ApplicationformDistrictBarComponent } from './applicationform-district-bar/applicationform-district-bar.component';
import { CreateIndentComponent } from './create-indent/create-indent.component';
import { IndentRequestComponent } from './indent-request/indent-request.component';
import { BarapplicationComponent } from './barapplication/barapplication.component';
import { BarapplicationHistoryComponent } from './barapplication-history/barapplication-history.component';
import { HBApplicationDetailComponent } from './hb-application-detail/hb-application-detail.component';
import { ApplicationformDistrictComponent } from './applicationform-district/applicationform-district.component';
import { CreateAuthPersonComponent } from './create-auth-person/create-auth-person.component';
import { VerifyAuthPersonsComponent } from './verify-auth-persons/verify-auth-persons.component';
import { HandoverOtpModalComponent } from './handover-otp-modal/handover-otp-modal.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [AuthGuard] },

  // ================= Admin, Staff & Office Combined Routes =================
  {
    path: 'stockentry',
    component: StockentryComponent,
    canActivate: [RoleGuard],
    data: { role: ['Admin', 'District', 'Staff'] }
  },
  {
    path: 'inventorydetails',
    component: InventorydetailsComponent,
    canActivate: [RoleGuard],
    data: { role: ['Admin', 'District', 'Nashik Admin', 'Staff'] }
  },
  {
    path: 'officeapplication',
    component: OfficeapplicationComponent,
    canActivate: [RoleGuard],
    data: { role: ['Admin', 'District', 'Officer', 'Staff', 'welcome_distilleries'] }
  },
  {
    path: 'office-application/:id',
    component: OfficeApplicationDetailComponent,
    canActivate: [RoleGuard],
    data: { role: ['Admin', 'District', 'Bar', 'Officer', 'Staff', 'welcome_distilleries', 'User'] }
  },
  {
    path: 'stock-report',
    component: StockReportComponent,
    canActivate: [RoleGuard],
    data: { role: ['Admin', 'Staff'] }
  },
  {
    path: 'stock-Ledger',
    component: StockLedgerComponent,
    canActivate: [RoleGuard],
    data: { role: ['Admin', 'Staff'] }
  },
  {
    path: 'create-Indent',
    component: CreateIndentComponent,
    canActivate: [RoleGuard],
    data: { role: ['Admin', 'Staff'] }
  },
  {
    path: 'verify-auth-persons',
    component: VerifyAuthPersonsComponent,
    canActivate: [RoleGuard],
    data: { role: ['Admin', 'Staff'] }
  },
  {
    path: 'handover-otp-modal',
    component: HandoverOtpModalComponent,
    canActivate: [RoleGuard],
    data: { role: ['Admin', 'Officer', 'Staff'] }
  },

  // ================= Nashik Admin Routes =================
  {
    path: 'nashik-stockentry',
    component: StockentryComponent,
    canActivate: [RoleGuard],
    data: { role: 'Nashik Admin' }
  },
  {
    path: 'nashik-inventorydetails',
    component: InventorydetailsComponent,
    canActivate: [RoleGuard],
    data: { role: 'Nashik Admin' }
  },
  {
    path: 'indent-Request',
    component: IndentRequestComponent,
    canActivate: [RoleGuard],
    data: { role: 'Nashik Admin' }
  },

  // ================= User / District / Bar Routes =================
  {
    path: 'applicationform',
    component: ApplicationformflComponent,
    canActivate: [RoleGuard],
    data: { role: ['User', 'District', 'Bar', 'welcome_distilleries'] }
  },
  {
    path: 'applicationHistory',
    component: ApplicationHistoryComponent,
    canActivate: [RoleGuard],
    data: { role: ['User', 'District', 'Bar', 'Admin', 'welcome_distilleries'] }
  },
  {
    path: 'application-detail/:id',
    component: ApplicationDetailComponent,
    canActivate: [RoleGuard],
    data: { role: ['User', 'Bar', 'District', 'Admin', 'welcome_distilleries'] }
  },
  {
    path: 'HBapplication-detail/:id',
    component: HBApplicationDetailComponent,
    canActivate: [RoleGuard],
    data: { role: ['User', 'Bar', 'District'] }
  },
  {
    path: 'wastagelable',
    component: WastageLableComponent,
    canActivate: [RoleGuard],
    data: { role: ['User', 'Bar', 'welcome_distilleries'] }
  },
  {
    path: 'wastage-review',
    loadComponent: () => import('./wastage-review/wastage-review.component').then(m => m.WastageReviewComponent),
    canActivate: [RoleGuard],
    data: { role: ['Admin', 'District'] }
  },
  {
    path: 'destroylabel',
    component: DestroyLabelComponent,
    canActivate: [RoleGuard],
    data: { role: ['Admin'] }
  },
  {
    path: 'ApplicationformDistrictBar',
    component: ApplicationformDistrictBarComponent,
    canActivate: [RoleGuard],
    data: { role: ['User', 'Bar'] }
  },
  {
    path: 'barapplication',
    component: BarapplicationComponent,
    canActivate: [RoleGuard],
    data: { role: ['District'] }
  },
  {
    path: 'barapplication-history',
    component: BarapplicationHistoryComponent,
    canActivate: [RoleGuard],
    data: { role: ['District', 'Bar'] }
  },
  {
    path: 'create-auth-person',
    component: CreateAuthPersonComponent,
    canActivate: [RoleGuard],
    data: { role: ['User', 'District', 'Bar', 'welcome_distilleries'] }
  },
  {
    path: 'ApplicationformDistrict',
    component: ApplicationformDistrictComponent,
    canActivate: [RoleGuard],
    data: { role: ['District'] }
  },

  // ================= Direct Forms =================
  { path: 'cl', component: ApplicationfromClComponent },
  { path: 'fl', component: ApplicationformflComponent },

  // ================= Approval Workflow Management (menu via Page_Master / Role_Page; API checks Admin) =================
  {
    path: 'approval-workflow-management',
    loadComponent: () => import('./approval-workflow-management/approval-workflow-management.component').then(m => m.ApprovalWorkflowManagementComponent),
    canActivate: [RoleGuard],
    data: { role: ['Admin'] }
  },

  {
    path: 'role-access-control',
    loadComponent: () => import('./role-access-control/role-access-control.component').then(m => m.RoleAccessControlComponent),
    canActivate: [RoleGuard]
  },

  // ================= Home Route =================
  {
    path: 'home',
    component: HomeComponent,
    canActivate: [RoleGuard],
    data: { role: ['Admin', 'User', 'District', 'Bar', 'welcome_distilleries', 'Officer', 'Staff','Deo'] }
  },

  // ================= Default Fallback Route =================
  { path: '**', redirectTo: 'home' }
];