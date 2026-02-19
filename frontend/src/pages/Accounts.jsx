import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import { 
  Wallet, 
  PiggyBank, 
  Store, 
  HelpCircle,
  TrendingUp,
  ArrowRight 
} from 'lucide-react'
import api from '../api/api'

export default function Accounts() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    loans: { balance: 0, count: 0 },
    savings: { balance: 0, count: 0 },
    transit: { balance: 0, count: 0 },
    suspense: { balance: 0, count: 0 }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAccountStats()
  }, [])

  const loadAccountStats = async () => {
    setLoading(true)
    try {
      const response = await api.get('/accounts/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to load account stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const accountTypes = [
    {
      id: 'loans',
      title: 'Loans Account',
      description: 'All loan disbursements and repayments',
      icon: Wallet,
      iconColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      path: '/accounts/loans',
      balance: stats.loans.balance,
      count: stats.loans.count,
      label: 'Active Loans'
    },
    {
      id: 'savings',
      title: 'Savings Accounts',
      description: 'Customer savings and deposits',
      icon: PiggyBank,
      iconColor: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      path: '/accounts/savings',
      balance: stats.savings.balance,
      count: stats.savings.count,
      label: 'Savings Accounts'
    },
    {
      id: 'transit',
      title: 'Transit Account',
      description: 'Late cash collections pending bank deposit',
      icon: Store,
      iconColor: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
      path: '/accounts/transit',
      balance: stats.transit.balance,
      count: stats.transit.count,
      label: 'Pending Deposits'
    },
    {
      id: 'suspense',
      title: 'Suspense Account',
      description: 'Unidentified payments awaiting matching',
      icon: HelpCircle,
      iconColor: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
      path: '/accounts/suspense',
      balance: stats.suspense.balance,
      count: stats.suspense.count,
      label: 'Unidentified Payments'
    },
  ]

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold dark:text-white mb-2">Accounts</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage all financial accounts</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {accountTypes.map((account) => {
              const Icon = account.icon
              
              return (
                <div
                  key={account.id}
                  onClick={() => navigate(account.path)}
                  className={`${account.bgColor} border ${account.borderColor} rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all group`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 ${account.bgColor} rounded-lg`}>
                      <Icon className={`w-8 h-8 ${account.iconColor}`} />
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                  </div>

                  <h3 className="text-xl font-bold dark:text-white mb-2">{account.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {account.description}
                  </p>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Balance</span>
                      <span className={`text-lg font-bold ${account.iconColor}`}>
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{account.label}</span>
                      <span className="text-lg font-semibold dark:text-white">
                        {account.count}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick Summary Cards */}
        {!loading && (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp size={20} />
              Total Balances Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {accountTypes.map((account) => (
                <div key={account.id} className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{account.title}</p>
                  <p className={`text-xl font-bold ${account.iconColor}`}>
                    {formatCurrency(account.balance)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}