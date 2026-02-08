import { useState, useEffect } from 'react'
import api from '../api/axios'
import Layout from '../components/Layout'
import { AlertTriangle, Calendar, User, Phone, Mail } from 'lucide-react'
import UserDetailsModal from '../components/UserDetailsModal'

export default function Defaults() {
  const [defaults, setDefaults] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [summary, setSummary] = useState({
    total_defaults: 0,
    total_default_amount: 0,
    total_disbursed_loans: 0,
    default_rate: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [defaultsRes, summaryRes] = await Promise.all([
        api.get('/defaults'),
        api.get('/defaults/summary')
      ])
      setDefaults(defaultsRes.data)
      setSummary(summaryRes.data)
    } catch (err) {
      console.error('Failed to fetch defaults:', err)
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

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getSeverityColor = (monthsOverdue) => {
    if (monthsOverdue >= 6) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
    if (monthsOverdue >= 3) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800'
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
  }

  const getSeverityLabel = (monthsOverdue) => {
    if (monthsOverdue >= 6) return 'Critical'
    if (monthsOverdue >= 3) return 'Severe'
    return 'Overdue'
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Loan Defaults</h1>
          <p className="text-gray-600 dark:text-gray-400">Customers who have missed monthly payments</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Defaults</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.total_defaults}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Default Amount</p>
                <p className="text-2xl font-bold dark:text-white">{formatCurrency(summary.total_default_amount)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Loans</p>
                <p className="text-2xl font-bold dark:text-white">{summary.total_disbursed_loans}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Default Rate</p>
                <p className="text-2xl font-bold dark:text-white">{summary.default_rate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Defaults List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold dark:text-white">Defaulting Customers</h2>
          </div>

          {defaults.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-green-500 dark:text-green-400" />
              <p className="text-lg font-medium text-green-600 dark:text-green-400">No defaults!</p>
              <p className="text-sm">All customers are up to date with payments.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Loan #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Last Payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Days Overdue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {defaults.map((item) => (
                    <tr key={item.loan_id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <button
                            onClick={() => setSelectedUserId(item.customer_id)}
                            className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-left"
                          >
                            {item.customer_name}
                          </button>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{item.customer_email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                        {item.application_number}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(item.loan_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(item.last_payment_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-red-600 dark:text-red-400">
                        {item.days_overdue} days ({item.months_overdue} months)
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getSeverityColor(item.months_overdue)}`}>
                          {getSeverityLabel(item.months_overdue)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUserId && (
        <UserDetailsModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </Layout>
  )
}