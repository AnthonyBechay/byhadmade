import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ChefHat, UtensilsCrossed, Salad, CalendarDays, Package,
  ScanLine, Settings, LogOut, BookOpen, Users, ClipboardList, X, CheckSquare, Thermometer,
} from 'lucide-react';
import { api } from '../lib/api';
import './Layout.css';

interface NavItem { to: string; icon: any; label: string; end?: boolean; feature?: string }
interface NavSection {
  key: string;
  label: string;
  icon: any;
  items: NavItem[];
}

const dashboardItem: NavItem = { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true };

const allSections: NavSection[] = [
  {
    key: 'menu',
    label: 'Menu Engineering',
    icon: BookOpen,
    items: [
      { to: '/app/ingredients', icon: Salad, label: 'Ingredients', feature: 'ingredients' },
      { to: '/app/menus', icon: UtensilsCrossed, label: 'Menus', feature: 'menus' },
      { to: '/app/recipes', icon: ChefHat, label: 'Recipes', feature: 'recipes' },
    ],
  },
  {
    key: 'people',
    label: 'People',
    icon: Users,
    items: [
      { to: '/app/scheduling', icon: CalendarDays, label: 'Schedules', feature: 'schedules' },
    ],
  },
  {
    key: 'ops',
    label: 'Operations',
    icon: ClipboardList,
    items: [
      { to: '/app/orders', icon: Package, label: 'Orders', feature: 'orders' },
      { to: '/app/traceability', icon: ScanLine, label: 'Traceability', feature: 'traceability' },
      { to: '/app/checklists', icon: CheckSquare, label: 'Checklists', feature: 'checklists' },
      { to: '/app/temperatures', icon: Thermometer, label: 'Temperature', feature: 'temperatures' },
    ],
  },
  {
    // Owner-only — filtered out entirely for sub-accounts.
    key: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      { to: '/app/settings', icon: Settings, label: 'Settings', end: true, feature: '__owner__' },
    ],
  },
];

interface MeResponse {
  role: 'owner' | 'sub-account';
  allowedFeatures?: string[];
}

function filterSections(me: MeResponse | null): NavSection[] {
  if (!me) return allSections; // optimistic: show everything until we know
  if (me.role === 'owner') return allSections;
  const allowed = me.allowedFeatures || [];
  // empty list = no restriction (matches backend semantics)
  const hasAll = allowed.length === 0;
  return allSections
    .map((s) => {
      // Sub-accounts still get a "Settings" section on mobile, but it only
      // contains the Sign Out action (rendered from the sheet itself).
      if (s.key === 'settings') return { ...s, items: [] };
      return {
        ...s,
        items: s.items.filter((it) => {
          if (it.feature === '__owner__') return false;
          if (hasAll) return true;
          return it.feature ? allowed.includes(it.feature) : true;
        }),
      };
    })
    .filter((s) => s.key === 'settings' || s.items.length > 0);
}

function findSectionForPath(pathname: string, sections: NavSection[]): string | null {
  // Longest-matching nav `to` wins
  const entries: { to: string; key: string | null }[] = [
    { to: dashboardItem.to, key: null },
    ...sections.flatMap((s) => s.items.map((it) => ({ to: it.to, key: s.key }))),
  ];
  let best: { to: string; key: string | null } | null = null;
  for (const entry of entries) {
    if (pathname === entry.to || pathname.startsWith(entry.to + '/')) {
      if (!best || entry.to.length > best.to.length) {
        best = entry;
      }
    }
  }
  return best ? best.key : null;
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [openSectionSheet, setOpenSectionSheet] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    api.get('/auth/me').then(setMe).catch(() => setMe(null));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const sections = filterSections(me);
  const currentSectionKey = findSectionForPath(location.pathname, sections);

  return (
    <div className="layout">
      {/* ── Desktop sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logo.png" alt="ByHadMade" className="logo-img" />
            <span className="logo-text">ByHadMade</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to={dashboardItem.to}
            end
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <dashboardItem.icon size={20} />
            <span>{dashboardItem.label}</span>
          </NavLink>

          {sections.map((section) => (
            <div key={section.key} className="sidebar-section">
              <div className="sidebar-section-header">
                <section.icon size={14} />
                <span>{section.label}</span>
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sidebar-link sidebar-subitem ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-link" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom bar (sections only, 4 icons + dashboard) ── */}
      <nav className="mobile-nav">
        <NavLink
          to={dashboardItem.to}
          end
          className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}
        >
          <dashboardItem.icon size={22} />
          <span>Home</span>
        </NavLink>
        {sections.map((section) => {
          const active = currentSectionKey === section.key;
          return (
            <button
              key={section.key}
              className={`mobile-nav-btn ${active ? 'active' : ''}`}
              onClick={() => setOpenSectionSheet(section.key)}
            >
              <section.icon size={22} />
              <span>{section.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Mobile section sheet (opened from bottom bar) ── */}
      {openSectionSheet && (() => {
        const section = sections.find((s) => s.key === openSectionSheet);
        if (!section) return null;
        return (
          <div className="mobile-sheet-overlay" onClick={() => setOpenSectionSheet(null)}>
            <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-sheet-header">
                <div className="mobile-sheet-title">
                  <section.icon size={18} />
                  <span>{section.label}</span>
                </div>
                <button className="btn-icon" onClick={() => setOpenSectionSheet(null)}>
                  <X size={20} />
                </button>
              </div>
              <div className="mobile-sheet-body">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpenSectionSheet(null)}
                    className={({ isActive }) => `mobile-sheet-link ${isActive ? 'active' : ''}`}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
                {section.key === 'settings' && (
                  <button className="mobile-sheet-link mobile-sheet-logout" onClick={handleLogout}>
                    <LogOut size={20} />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
