import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ChefHat, UtensilsCrossed, Salad, CalendarDays, LogOut } from 'lucide-react';
import './Layout.css';

const navItems = [
  { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/app/recipes', icon: ChefHat, label: 'Recipes' },
  { to: '/app/ingredients', icon: Salad, label: 'Ingredients' },
  { to: '/app/menus', icon: UtensilsCrossed, label: 'Menus' },
  { to: '/app/scheduling', icon: CalendarDays, label: 'Scheduling' },
];

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logo.png" alt="ByHadMade" className="logo-img" />
            <span className="logo-text">ByHadMade</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button className="sidebar-link sidebar-logout-mobile" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Out</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-link" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
