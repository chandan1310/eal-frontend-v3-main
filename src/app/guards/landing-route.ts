/**
 * Where a logged-in user should land.
 * Approval-level officers (role whose only menu is Check Demand Raise) never see Home –
 * they always land on Check Demand Raise. Everyone else lands on Home as before.
 */
export const CHECK_DEMAND_ROUTE = 'officeapplication';

export function isCheckDemandOnlyUser(): boolean {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    const raw = sessionStorage.getItem('allowed_routes');
    if (!raw) return false;
    const urls = (JSON.parse(raw) as any[])
      .map(u => String(u || '').trim().replace(/^\/+/, '').toLowerCase())
      .filter(Boolean);
    return urls.length > 0 && urls.every(u => u === CHECK_DEMAND_ROUTE);
  } catch {
    return false;
  }
}

export function landingRoute(): string {
  return isCheckDemandOnlyUser() ? '/' + CHECK_DEMAND_ROUTE : '/home';
}
