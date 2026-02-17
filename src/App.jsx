import { useState } from 'react'
import FinancialDashboard from './financial-dashboard.jsx'
import EmployeeManagement from './employee-management.jsx'
import RolePermissions from './role-permissions.jsx'
import InventoryManagement from './inventory-management.jsx'
import RoomsManagement from './rooms-management.jsx'
import PricingManagement from './pricing-management.jsx'


function App() {
  const [currentPage, setCurrentPage] = useState('financial')


  return (
    <div>
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-8 py-4">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-white">🏨 Hotel System</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage('financial')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === 'financial'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                💰 Financeiro
              </button>

              <button
                onClick={() => setCurrentPage('employees')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === 'employees'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                👥 Funcionários
              </button>

              <button
                onClick={() => setCurrentPage('inventory')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === 'inventory'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                📦 Itens / Almoxarifado
              </button>

              <button
                onClick={() => setCurrentPage('permissions')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === 'permissions'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                🔐 Cargos e Permissões
              </button>

              <button
                onClick={() => setCurrentPage('rooms')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === 'rooms'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                🛏️ Quartos
              </button>

              {/* ADICIONE ESTE BOTÃO */}
              <button
                onClick={() => setCurrentPage('pricing')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === 'pricing'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                💵 Preços
              </button>
            </div>
          </div>
        </div>
      </nav>

      {currentPage === 'financial' && <FinancialDashboard />}
      {currentPage === 'employees' && <EmployeeManagement />}
      {currentPage === 'inventory' && <InventoryManagement />}
      {currentPage === 'permissions' && <RolePermissions />}
      {currentPage === 'rooms' && <RoomsManagement />}
      {currentPage === 'pricing' && <PricingManagement />}
    </div>
  )
}

export default App
