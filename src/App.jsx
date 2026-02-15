import { useState } from 'react'
import FinancialDashboard from './financial-dashboard.jsx'
import EmployeeManagement from './employee-management.jsx'
import RolePermissions from './role-permissions.jsx'

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
                onClick={() => setCurrentPage('permissions')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === 'permissions'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                🔐 Cargos e Permissões
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {currentPage === 'financial' && <FinancialDashboard />}
      {currentPage === 'employees' && <EmployeeManagement />}
      {currentPage === 'permissions' && <RolePermissions />}
    </div>
  )
}

export default App
