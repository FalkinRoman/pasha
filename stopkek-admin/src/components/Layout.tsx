import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { fetchDashboard } from '../api/admin';
import { useAuth } from '../auth/AuthContext';
import { StopLogo } from './StopLogo';
import './Layout.css';

const nav = [
  { to: '/', label: 'Дашборд', end: true },
  { to: '/seats', label: 'Места и зоны' },
  { to: '/verifications', label: 'Верификация' },
  { to: '/bookings', label: 'Брони' },
  { to: '/users', label: 'Клиенты' },
  { to: '/transactions', label: 'Транзакции' },
  { to: '/feedback', label: 'Отзывы' },
  { to: '/settings', label: 'Настройки' },
];

export function Layout() {
  const { admin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const location = useLocation();

  const loadPending = useCallback(() => {
    fetchDashboard()
      .then((d) => setPendingVerifications(d.pendingVerifications ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPending();
    const id = setInterval(loadPending, 10000);
    return () => clearInterval(id);
  }, [loadPending, location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="layout">
      <header className="mobile-header">
        <button
          type="button"
          className="menu-btn"
          aria-label="Меню"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
        <StopLogo size={40} />
        <span className="mobile-header-title">Admin</span>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <StopLogo size={52} />
          <p className="brand-wordmark brand-wordmark-sm">стопкек</p>
          <small>Admin</small>
        </div>
        <nav className="sidebar-nav">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <span className="nav-link-label">{item.label}</span>
              {item.to === '/verifications' && pendingVerifications > 0 ? (
                <span className="nav-badge">{pendingVerifications}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="admin-email">{admin?.email}</div>
          <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={logout}>
            Выйти
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
