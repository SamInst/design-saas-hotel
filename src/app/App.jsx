import { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import LoginPage from '../pages/LoginPage';
import { useTheme } from '../hooks/useTheme';

import FinancialDashboard  from '../pages/financial/FinancialDashboard';
import RegistersPage       from '../pages/registers/RegistersPage';
import EmployeeManagement  from '../pages/employees/EmployeeManagement';
// import RolePermissions     from '../pages/permissions/RolePermissions';
// import InventoryManagement from '../pages/inventory/InventoryManagement';
// import RoomsManagement     from '../pages/rooms/RoomsManagement';
// import PricingManagement   from '../pages/pricing/PricingManagement';
// import StaysManagement     from '../pages/stays/StaysManagement';
// import BookingCalendar     from '../pages/calendar/BookingCalendar';

const PAGE_MAP = {
  financial:   <FinancialDashboard />,
  registers:   <RegistersPage />,
  employees:   <EmployeeManagement />,
  // inventory:   <InventoryManagement />,
  // permissions: <RolePermissions />,
  // rooms:       <RoomsManagement />,
  // pricing:     <PricingManagement />,
  // stays:       <StaysManagement />,
  // calendar:    <BookingCalendar />,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState('financial');
  const [user, setUser] = useState(null);
  const { isDark, toggleTheme } = useTheme();

  if (!user) return <LoginPage onLogin={setUser} />;

  return (
    <AppLayout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      user={user}
      isDark={isDark}
      onToggleTheme={toggleTheme}
      onLogout={() => setUser(null)}
    >
      {PAGE_MAP[currentPage]}
    </AppLayout>
  );
}
