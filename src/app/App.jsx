import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import LoginPage from '../pages/LoginPage';
import { useTheme } from '../hooks/useTheme';
import { userStorage, tokenStorage, authApi } from '../services/api';

import FinancialDashboard  from '../pages/financial/FinancialDashboard';
import RegistersPage       from '../pages/registers/RegistersPage';
import EmployeeManagement  from '../pages/employees/EmployeeManagement';
import RolePermissions     from '../pages/permissions/RolePermissions';
import InventoryManagement from '../pages/inventory/InventoryManagement';
// import RoomsManagement     from '../pages/rooms/RoomsManagement';
// import PricingManagement   from '../pages/pricing/PricingManagement';
// import StaysManagement     from '../pages/stays/StaysManagement';
// import BookingCalendar     from '../pages/calendar/BookingCalendar';

const PAGE_MAP = {
  financial:   <FinancialDashboard />,
  registers:   <RegistersPage />,
  employees:   <EmployeeManagement />,
  permissions: <RolePermissions />,
  inventory:   <InventoryManagement />,
  // rooms:       <RoomsManagement />,
  // pricing:     <PricingManagement />,
  // stays:       <StaysManagement />,
  // calendar:    <BookingCalendar />,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState(() => {
    return localStorage.getItem('currentPage') || 'financial';
  });
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isDark, toggleTheme } = useTheme();

  // Salva a página atual no localStorage quando muda
  useEffect(() => {
    localStorage.setItem('currentPage', currentPage);
  }, [currentPage]);

  // Restaura sessão do localStorage ao montar
  useEffect(() => {
    const storedToken = tokenStorage.get();
    const storedUser = userStorage.get();

    if (storedToken && storedUser) {
      // Valida se a sessão ainda está ativa no backend
      if (authApi.isAuthenticated()) {
        setUser(storedUser);
      } else {
        // Token expirou ou é inválido, limpa o storage
        authApi.logout();
      }
    }
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    authApi.logout(); // Limpa localStorage
    setUser(null);
  };

  // Redireciona para login quando o token expirar/for inválido (401)
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div>Carregando...</div>
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={setUser} />;

  return (
    <AppLayout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      user={user}
      isDark={isDark}
      onToggleTheme={toggleTheme}
      onLogout={handleLogout}
    >
      {PAGE_MAP[currentPage]}
    </AppLayout>
  );
}
