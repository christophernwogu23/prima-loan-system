import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuthStore } from '../../store/authStore'
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { getApplications } from '../../api/applications'
import { getPayments } from '../../api/payments'

export default function LoansAccount() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    total_disbursed: 0,
    total_repaid: 0,
    outstanding_balance: 0,
    active_loans: 0
  })
  const [applications, setApplications] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [appsData, paymentsData] = await Promise.all([
        getApplications(),
        getPayments()
      ])
      
      setApplications(appsData)
      setPayments(paymentsData)
      
      // Calculate stats
      const disbursedLoans = appsData.filter(app => app.status === 'disbursed')
      const totalDisbursed = disbursedLoans.reduce((sum, loan) => 
        sum + (loan.approved_amount || loan.requested_amount), 0
      )
      const totalRepaid = paymentsData.reduce((sum, payment) => sum + payment.amount, 0)
      
      setStats({
        total_disbursed: totalDisbursed,
        total_repaid: totalRepaid,
        outstanding_balance: totalDisbursed - totalRepaid,
        active_loans: disbursedLoans.length
      })
    } catch (error) {
      console.error('Failed to load loan account data:', error)
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
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/accounts')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft size={20} className="dark:text-white" />
          </button>
          <div>
            <h2 className="text-2xl font-bold dark:text-white">Loans Account</h2>
            <p className="text-gray-600 dark:text-gray-400">All loan disbursements and repayments</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Disbursed</p>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(stats.total_disbursed)}
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingDown className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Repaid</p>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(stats.total_repaid)}
                </p>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Outstanding</p>
                </div>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {formatCurrency(stats.outstanding_balance)}
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Active Loans</p>
                </div>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {stats.active_loans}
                </p>
              </div>
            </div>

            {/* Recent Disbursed Loans */}
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold dark:text-white mb-4">Recent Disbursed Loans</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b dark:border-gray-700">
                    <tr>
                      <th className="text-left py-3 text-sm font-semibold dark:text-white">Loan ID</th>
                      <th className="text-left py-3 text-sm font-semibold dark:text-white">Customer</th>
                      <th className="text-right py-3 text-sm font-semibold dark:text-white">Amount</th>
                      <th className="text-left py-3 text-sm font-semibold dark:text-white">Date</th>
                      <th className="text-left py-3 text-sm font-semibold dark:text-white">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {applications
                      .filter(app => app.status === 'disbursed')
                      .slice(0, 10)
                      .map(app => (
                        <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="py-3 text-sm dark:text-white">{app.application_number}</td>
                          <td className="py-3 text-sm dark:text-gray-300">Customer #{app.customer_id}</td>
                          <td className="py-3 text-sm font-medium text-right text-blue-600 dark:text-blue-400">
                            {formatCurrency(app.approved_amount || app.requested_amount)}
                          </td>
                          <td className="py-3 text-sm text-gray-500 dark:text-gray-400">
                            {new Date(app.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded-full">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Payments */}
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold dark:text-white mb-4">Recent Repayments</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b dark:border-gray-700">
                    <tr>
                      <th className="text-left py-3 text-sm font-semibold dark:text-white">Date</th>
                      <th className="text-left py-3 text-sm font-semibold dark:text-white">Customer</th>
                      <th className="text-right py-3 text-sm font-semibold dark:text-white">Amount</th>
                      <th className="text-left py-3 text-sm font-semibold dark:text-white">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {payments.slice(0, 10).map(payment => (
                      <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-3 text-sm dark:text-white">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-sm dark:text-gray-300">{payment.customer_name}</td>
                        <td className="py-3 text-sm font-medium text-right text-green-600 dark:text-green-400">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="py-3 text-sm text-gray-500 dark:text-gray-400 capitalize">
                          {payment.payment_method?.replace('_', ' ')}
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