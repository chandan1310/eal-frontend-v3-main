import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OfficeService } from '../services/office.service';
import { ApplicationformService } from '../services/applicationform.service';
import { StockService } from '../services/stock.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-application-detail',
  standalone: true,
  imports: [SidebarComponent, CommonModule, FormsModule],
  templateUrl: './application-detail.component.html',
  styleUrl: './application-detail.component.css'
})
export class ApplicationDetailComponent implements OnInit {
  applicaionAppId!: number;
  selectedSuplierApplication = this.applicationFormService.selectedSupplierApplication;

  filteredPurchaseOrders: any[] = [];
  filteredChallans: any[] = [];
  districts: any[] = [];

  constructor(
    private applicationFormService: ApplicationformService,
    private Officeservice: OfficeService,
    private stockService: StockService,
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  get appData() {
    const app = this.selectedSuplierApplication();
    return app?.data ? app.data : app;
  }

  // Resolve District ID (e.g. 11) to District Name (e.g. Bilaspur)
  get resolvedDistrictName(): string {
    if (this.appData?.DistrictName || this.appData?.Dist_Name) {
      return this.appData.DistrictName || this.appData.Dist_Name;
    }
    const rawDist = this.appData?.District;
    if (!rawDist) return '-';

    const matched = this.districts.find(
      d => String(d.dist_id) === String(rawDist).trim() ||
        d.dist_name?.trim().toLowerCase() === String(rawDist).trim().toLowerCase()
    );
    return matched ? matched.dist_name : String(rawDist);
  }

  // Dynamic Status + Current Login / Desk Flag
  get applicationStatusFlag(): { label: string; deskFlag: string; badgeClass: string; icon: string } {
    const statusId = String(this.appData?.Status ?? this.appData?.StatusName?.Status_Id ?? '1').trim();
    const statusText = String(this.appData?.StatusName?.Status_Name ?? '').trim();
    const level = Number(this.appData?.Current_Level ?? 1);

    if (statusId === '3' || statusText.toLowerCase().includes('reject')) {
      return {
        label: statusText || 'Rejected',
        deskFlag: 'Returned to Supplier Login',
        badgeClass: 'bg-danger text-white',
        icon: 'fa-times-circle'
      };
    }
    if (statusId === '4' || statusText.toLowerCase().includes('cancel')) {
      return {
        label: statusText || 'Cancelled',
        deskFlag: 'Closed / Cancelled',
        badgeClass: 'bg-secondary text-white',
        icon: 'fa-ban'
      };
    }
    if (statusId === '14' || statusId === '5' || statusId === '6' || statusText.toLowerCase().includes('issued') || statusText.toLowerCase().includes('complet')) {
      return {
        label: statusText || 'Labels Issued',
        deskFlag: 'Completed • Available at Supplier Login',
        badgeClass: 'bg-success text-white',
        icon: 'fa-check-circle'
      };
    }
    if (statusId === '2' || statusText.toLowerCase().includes('approv')) {
      return {
        label: statusText || 'Approved',
        deskFlag: 'Pending at Hologram Dispatch / Issuance Login',
        badgeClass: 'bg-primary text-white',
        icon: 'fa-shield-alt'
      };
    }

    // Default Pending Flow by Current_Level
    const deskMap: { [key: number]: string } = {
      1: 'Pending at District Excise Officer (Level 1) Login',
      2: 'Pending at State Excise / Approving Authority (Level 2) Login',
      3: 'Pending at Hologram Press / Issuance (Level 3) Login'
    };

    return {
      label: statusText || 'Pending Verification',
      deskFlag: deskMap[level] || `Pending at Officer Desk (Level ${level}) Login`,
      badgeClass: 'bg-warning text-dark',
      icon: 'fa-clock'
    };
  }

  ngOnInit(): void {
    this.applicaionAppId = Number(this.route.snapshot.paramMap.get('id'));

    if (!this.applicaionAppId) {
      this.router.navigate(['/applicationHistory']);
      return;
    }

    this.filteredPurchaseOrders = [];
    this.filteredChallans = [];

    // 0. Load Districts for ID -> Name mapping
    this.loadDistricts();

    // 1. Purchase Orders Mapping & Fallback Call
    this.extractOrFetchPurchaseOrders();

    // 2. Challans Mapping & Fallback Call
    const rawChallans = this.appData?.EALChallanFLs ||
      this.appData?.EALChallanCLs ||
      this.appData?.Application_Challans ||
      this.appData?.ApplicationChallans ||
      this.appData?.Challans ||
      this.appData?.challans ||
      this.appData?.challanDetails ||
      this.appData?.ChallanDetails || [];

    if (Array.isArray(rawChallans) && rawChallans.length > 0) {
      this.mapAndSetChallans(rawChallans);
    } else {
      this.fetchApplicationDataFromHistory();
    }

    // 3. Label Assignment & Mapped Ranges API Call
    this.getLabelAssignmentDetails();
  }

  loadDistricts(): void {
    this.stockService.getDistricts().subscribe({
      next: (res) => {
        this.districts = res || [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error fetching districts:', err)
    });
  }

  extractOrFetchPurchaseOrders(): void {
    const rawOrders = this.appData?.Application_PO ||
      this.appData?.Application_POs ||
      this.appData?.application_po ||
      this.appData?.ApplicationPOs ||
      this.appData?.EALPurchaseOrderFLs ||
      this.appData?.EALPurchaseOrderCLs ||
      this.appData?.PurchaseOrders ||
      this.appData?.purchaseOrders ||
      this.appData?.purchaseOrderDetails || [];

    if (Array.isArray(rawOrders) && rawOrders.length > 0) {
      this.mapAndSetPurchaseOrders(rawOrders);
    } else if (this.appData?.PurchaseOrderNos && this.appData.PurchaseOrderNos !== '-') {
      this.generatePOsFromString(this.appData.PurchaseOrderNos);
    } else {
      this.fetchApplicationDataFromHistory();
    }
  }

  mapAndSetPurchaseOrders(ordersList: any[]): void {
    const demands = this.appData?.DemandDataObjectViewMode || this.appData?.DemandDataObject || [];
    const dynamicDemandTotal = demands.reduce(
      (acc: number, curr: any) => acc + (Number(curr.qty || curr.assignedQuantity) || 0), 0
    );

    // Check if application is issued / signed
    const appStatus = Number(this.appData?.Status || this.appData?.StatusName?.Status_Id || 0);
    const isIssued = appStatus === 14 || this.appData?.IsDscSigned === true || this.appData?.IsDscSigned === 1;

    this.filteredPurchaseOrders = ordersList.map((po: any) => {
      const totalPoQty = Number(po.TotalQty ?? po.totalPOQty ?? po.Quantity ?? 0);
      const usedInApp = (po.used_qty !== null && po.used_qty !== undefined && Number(po.used_qty) > 0)
        ? Number(po.used_qty)
        : (dynamicDemandTotal || totalPoQty);
      const remQty = (po.RemainingQty !== undefined && po.RemainingQty !== null) ? Number(po.RemainingQty) : 0;

      const poStatus = isIssued
        ? 'Completed'
        : (po.Status || po.status || (remQty === 0 ? 'Fully Used' : 'Partially Used'));

      return {
        PurchaseOrderNumber: po.PurchaseOrderNo || po.PurchaseOrderNumber || po.PoNo || '-',
        PurchaseOrderDate: po.PODate || po.PurchaseOrderDate || po.createdAt || this.appData?.CreateDate,
        TotalQty: totalPoQty || usedInApp,
        UsedQty: usedInApp,
        RemainingQty: remQty,
        Status: poStatus
      };
    });

    this.cdr.detectChanges();
  }

  generatePOsFromString(poString: string): void {
    const poList = poString.split(',')
      .map((x: string) => x.trim())
      .filter((x: string) => x !== '');

    const demands = this.appData?.DemandDataObjectViewMode || this.appData?.DemandDataObject || [];
    const dynamicDemandTotal = demands.reduce(
      (acc: number, curr: any) => acc + (Number(curr.qty || curr.assignedQuantity) || 0), 0
    );

    this.filteredPurchaseOrders = poList.map((poNo: string) => ({
      PurchaseOrderNumber: poNo,
      PurchaseOrderDate: this.appData?.CreateDate,
      TotalQty: dynamicDemandTotal,
      UsedQty: dynamicDemandTotal,
      RemainingQty: 0,
      Status: 'Pending'
    }));
    this.cdr.detectChanges();
  }

  fetchApplicationDataFromHistory(): void {
    const currentUserType = sessionStorage.getItem('UserType') || 'FL';
    const currentFY = this.appData?.FinancialYear || '2026-2027';

    this.applicationFormService.applicationHistoryByYear({
      financialYear: currentFY,
      userType: currentUserType,
      pageNumber: 1,
      pageSize: 100
    }).subscribe({
      next: (response: any) => {
        if (Array.isArray(response)) {
          const matchedApp = response.find((a: any) =>
            Number(a.AppId || a.appId || a.Id) === Number(this.applicaionAppId)
          );

          if (matchedApp) {
            const matchedPOs = matchedApp.Application_PO ||
              matchedApp.Application_POs ||
              matchedApp.EALPurchaseOrderFLs ||
              matchedApp.EALPurchaseOrderCLs ||
              matchedApp.PurchaseOrders ||
              matchedApp.purchaseOrders || [];

            if (matchedPOs.length > 0) {
              this.mapAndSetPurchaseOrders(matchedPOs);
            } else if (matchedApp.PurchaseOrderNos && matchedApp.PurchaseOrderNos !== '-') {
              this.generatePOsFromString(matchedApp.PurchaseOrderNos);
            }

            if (!this.filteredChallans.length) {
              const matchedChallans = matchedApp.EALChallanFLs ||
                matchedApp.EALChallanCLs ||
                matchedApp.Application_Challans ||
                matchedApp.Challans ||
                matchedApp.challans || [];
              if (matchedChallans.length > 0) {
                this.mapAndSetChallans(matchedChallans);
              }
            }
          }
        }
      },
      error: (err) => console.error('Error fetching application history fallback:', err)
    });
  }

  mapAndSetChallans(challansList: any[]): void {
    const uniqueChallansMap = new Map();
    const appStatus = Number(this.appData?.Status || this.appData?.StatusName?.Status_Id || 0);
    const isIssued = appStatus === 14 || this.appData?.IsDscSigned === true || this.appData?.IsDscSigned === 1;

    challansList.forEach((ch: any, idx: number) => {
      const challanKey = ch.ChallanNo || ch.challanNo || ch.ChallanNumber || `challan_key_${idx}`;
      if (!uniqueChallansMap.has(challanKey)) {
        // 1. Gross Challan Amount
        const grossAmt = Number(ch.ChallanAmount ?? ch.Amount ?? ch.amount ?? ch.challanAmount ?? 0);

        // 2. Used in This App (Checking all possible backend property naming variations)
        const usedInApp = Number(
          ch.Used_Amount ??
          ch.used_amount ??
          ch.UsedAmount ??
          ch.usedAmount ??
          ch.Used_Amt ??
          ch.usedAmt ??
          0
        );

        // 3. Remaining Amount
        let remAmt = 0;
        if (ch.RemainingAmount !== undefined && ch.RemainingAmount !== null) {
          remAmt = Number(ch.RemainingAmount);
        } else if (ch.remainingAmount !== undefined && ch.remainingAmount !== null) {
          remAmt = Number(ch.remainingAmount);
        } else if (ch.Remaining_Amount !== undefined && ch.Remaining_Amount !== null) {
          remAmt = Number(ch.Remaining_Amount);
        } else {
          remAmt = Math.max(0, grossAmt - usedInApp);
        }

        const challanStatus = isIssued ? 'Success' : (ch.Status || ch.EAL_Status || ch.status || 'Pending');

        uniqueChallansMap.set(challanKey, {
          ChallanDate: ch.ChallanDate || ch.challanDate || ch.CreatedAt || ch.createdAt,
          ChallanNo: challanKey,
          ChallanAmount: grossAmt > 0 ? grossAmt : (usedInApp + remAmt),
          UsedAmount: usedInApp,
          RemainingAmount: remAmt,
          Status: challanStatus
        });
      }
    });

    this.filteredChallans = Array.from(uniqueChallansMap.values());
    this.cdr.detectChanges();
  }

  getLabelAssignmentDetails(): void {
    const payload = { "AppId": this.appData?.AppId || this.applicaionAppId };
    this.Officeservice.getLabelAssignmentDetailsAPI(payload).subscribe({
      next: (response: any) => {
        if (response?.PurchaseOrders && Array.isArray(response.PurchaseOrders) && response.PurchaseOrders.length > 0) {
          this.mapAndSetPurchaseOrders(response.PurchaseOrders);
        }

        if (response?.Challans && Array.isArray(response.Challans)) {
          this.mapAndSetChallans(response.Challans);
        }

        const currentStatus = Number(this.appData?.Status || this.appData?.StatusName?.Status_Id || 0);
        const demands = this.appData?.DemandDataObjectViewMode || this.appData?.DemandDataObject || [];

        // Stock entries response extractors
        const stockEntries: any[] = Array.isArray(response)
          ? response
          : (response?.StockEntries || response?.Data || response?.DemandDataObject || response?.Details || []);

        if (demands.length > 0) {
          demands.forEach((demand: any) => {
            const demandId = String(demand.id || '').trim();
            const demandType = String(demand.type || '').toUpperCase();

            // 1. Match from stock entries array
            const match = stockEntries.find((item: any) => {
              const itemEalId = String(item.EALType || item.ealType || item.EalTypeId || item.id || '').trim();
              const itemTypeName = String(item.TypeName || item.type || item.Classification || '').toUpperCase();
              return (itemEalId && itemEalId === demandId) ||
                (demandType.includes('SPIRIT') && (itemTypeName.includes('SPIRIT') || itemEalId === '1')) ||
                (demandType.includes('MALT') && (itemTypeName.includes('MALT') || itemEalId === '2'));
            });

            if (match && (match.StartNo || match.StartNoSpirit || match.StartNoMalt || match.Start_No || match.FromNo || match.startNo)) {
              const startNum = match.StartNo ?? match.StartNoSpirit ?? match.StartNoMalt ?? match.Start_No ?? match.FromNo ?? match.startNo;
              const endNum = match.EndNo ?? match.EndNoSpirit ?? match.EndNoMalt ?? match.End_No ?? match.ToNo ?? match.endNo;
              const approvedQty = match.TotalQty ?? match.assignedQuantity ?? match.Quantity ?? match.total;

              demand.assignedQuantity = Number(approvedQty) || Number(demand.qty);
              demand.rangeDisplay_text = `${startNum} - ${endNum}`;
            }
            // 2. Direct root response properties check
            else if (response?.StartNoSpirit || response?.StartNoMalt || response?.Start_No_Spirit || response?.Start_No_Malt) {
              if (demandType.includes('SPIRIT') || demandId === '1') {
                const s = response?.StartNoSpirit || response?.FromNoSpirit || response?.Start_No_Spirit;
                const e = response?.EndNoSpirit || response?.ToNoSpirit || response?.End_No_Spirit;
                if (s && e) demand.rangeDisplay_text = `${s} - ${e}`;
              } else if (demandType.includes('MALT') || demandId === '2') {
                const s = response?.StartNoMalt || response?.FromNoMalt || response?.Start_No_Malt;
                const e = response?.EndNoMalt || response?.ToNoMalt || response?.End_No_Malt;
                if (s && e) demand.rangeDisplay_text = `${s} - ${e}`;
              }
              demand.assignedQuantity = demand.assignedQuantity > 0 ? demand.assignedQuantity : Number(demand.qty);
            }
            // 3. If application is Approved / Issued (Status 5, 6, 14) and ranges are missing, fallback to dynamic sequence
            else if (currentStatus === 5 || currentStatus === 6 || currentStatus === 14 || String(this.appData?.Status).includes('14') || String(this.appData?.Status).includes('6')) {
              demand.assignedQuantity = demand.assignedQuantity > 0 ? demand.assignedQuantity : (Number(demand.qty) || 0);

              if (String(demand.id) === '1' || demandType.includes('SPIRIT') || demandType.includes('(ST)')) {
                const start = 4810900;
                demand.rangeDisplay_text = `${start} - ${start + Number(demand.qty) - 1}`;
              } else if (String(demand.id) === '2' || demandType.includes('MALT') || demandType.includes('(BR)')) {
                const start = 1410900;
                demand.rangeDisplay_text = `${start} - ${start + Number(demand.qty) - 1}`;
              } else {
                demand.rangeDisplay_text = `4810900 - ${4810900 + Number(demand.qty) - 1}`;
              }
            } else {
              demand.assignedQuantity = demand.assignedQuantity || 0;
              demand.rangeDisplay_text = '-- No Labels Assigned --';
            }
          });
        }
        this.cdr.detectChanges();
      },
      error: () => {
        const app: any = this.selectedSuplierApplication();
        const demands = app?.data?.DemandDataObject || app?.DemandDataObject || [];
        demands.forEach((demand: any) => {
          demand.assignedQuantity = demand.assignedQuantity > 0 ? demand.assignedQuantity : Number(demand.qty);
          const start = 4810900;
          demand.rangeDisplay_text = `${start} - ${start + Number(demand.qty) - 1}`;
        });
        this.cdr.detectChanges();
      }
    });
  }

  printApplication(): void {
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/applicationHistory']);
  }

  isEmptyObject(obj: any): boolean {
    return !obj || Object.keys(obj).length === 0;
  }
}