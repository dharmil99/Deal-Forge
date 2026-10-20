export interface NavItem {
  id: string;
  label: string;
  path: string;
  badge?: string | number;
  exact?: boolean;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
  current?: boolean;
}

export interface TickerItem {
  symbol: string;
  value: string;
  change: string;
  isPositive: boolean;
  companyId?: string;
}
