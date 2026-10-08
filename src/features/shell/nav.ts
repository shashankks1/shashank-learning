import type { IconName } from '../../components/Icon';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  /** Second key of the "g then x" shortcut. */
  key: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '#/dashboard', icon: 'dashboard', key: 'd' },
  { id: 'curriculum', label: 'Curriculum', href: '#/curriculum', icon: 'curriculum', key: 'c' },
  { id: 'builds', label: 'Builds', href: '#/builds', icon: 'builds', key: 'b' },
  { id: 'mastery', label: 'Mastery', href: '#/mastery', icon: 'mastery', key: 'm' },
  { id: 'lab', label: 'Opportunity Lab', href: '#/lab', icon: 'lab', key: 'o' },
  { id: 'portfolio', label: 'Portfolio', href: '#/portfolio', icon: 'portfolio', key: 'p' },
  { id: 'log', label: 'Build Log', href: '#/log', icon: 'log', key: 'l' },
  { id: 'career', label: 'Career', href: '#/career', icon: 'career', key: 'j' },
  { id: 'resources', label: 'Resources', href: '#/resources', icon: 'resources', key: 'r' },
  { id: 'settings', label: 'Settings', href: '#/settings', icon: 'settings', key: 's' },
];

export const REPORT_ITEM: NavItem = { id: 'report', label: 'Capability Report', href: '#/report', icon: 'report', key: 'y' };

/** Bottom bar on phones: the daily essentials. Everything else lives in the drawer. */
export const MOBILE_TABS = ['dashboard', 'curriculum', 'builds', 'log'];
