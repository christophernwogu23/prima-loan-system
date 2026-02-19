import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { ArrowLeft, Users, TrendingUp } from 'lucide-react'
import api from '../../api/api'

export default function SavingsAccount() {
  const navigate = useNavigate()
  const [savings, setSavings] = useState([])
  const [stats, setStats] = useState({ total_balance: 0, accounts_count: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await api.get('/savings/')
      setSavings(response.data)
      
      const totalBalance = response.data.reduce((sum, s) => sum + s.balance, 0)
      setStats({
        total_balance: totalBalance,
        accounts_count: response.data.length
      })
    } catch (error) {
      console.error('Failed to load savings:', error)
    } finally {
      setLoading(false)
    }
  }

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
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/accounts')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft size={20} className="dark:text-white" />
          </button>
          <div>
            <h2 className="text-2xl font-bold dark:text-white">Savings Accounts</h2>
            <p className="text-gray-600 dark:text-gray-400">Customer savings and deposits</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Savings Balance</p>
                </div>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(stats.total_balance)}
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Active Accounts</p>
                </div>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {stats.accounts_count}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold dark:text-white mb-4">Savings Accounts</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b dark:border-gray-700">
                    <tr>
                      <th className="text-left py-3 text-sm font-semibold dark:text-white">Customer</th>
                      <th className="text-right py-3 text-sm font-semibold dark:text-white">Balance</th>
                      <th className="text-left py-3 text-sm font-semibold dark:text-white">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {savings.map(saving => (
                      <tr key={saving.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-3 text-sm dark:text-white">
                          Customer #{saving.user_id}
                        </td>
                        <td className="py-3 text-sm font-medium text-right text-green-600 dark:text-green-400">
                          {formatCurrency(saving.balance)}
                        </td>
                        <td className="py-3 text-sm text-gray-500 dark:text-gray-400">
                          {saving.updated_at ? new Date(saving.updated_at).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}