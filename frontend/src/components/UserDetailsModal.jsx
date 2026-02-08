import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import api from '../api/axios'
import { getUserFinancialSummary } from '../api/users'

export default function UserDetailsModal({ userId, onClose }) {
  const [user, setUser] = useState(null)
  const [financialSummary, setFinancialSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUserDetails()
  }, [userId])

  const loadUserDetails = async () => {
    try {
      const [userData, summaryData] = await Promise.all([
        api.get(`/users/${userId}`),
        getUserFinancialSummary(userId)
      ])
      setUser(userData.data)
      setFinancialSummary(summaryData)
    } catch (error) {
      console.error('Failed to load user details:', error)
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

  const getRiskScoreColor = (score) => {
    if (score >= 16) return 'text-green-600'
    if (score >= 12) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRiskLabel = (score) => {
    if (score >= 16) return 'LOW RISK'
    if (score >= 12) return 'MEDIUM RISK'
    return 'HIGH RISK'
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Customer Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Customer Info Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-100">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {user.first_name?.[0]}{user.last_name?.[0]}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {user.first_name} {user.last_name}
                </h3>
                <p className="text-gray-600">ID: {user.id}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Financial Summary Grid */}
         {user.role === 'customer' && financialSummary !== null && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Total Borrowed */}
              <div className="bg-gray-900 text-white rounded-xl p-6">
                <p className="text-gray-400 text-sm mb-2">Total Borrowed</p>
                <p className="text-3xl font-bold">{formatCurrency(financialSummary.total_borrowed)}</p>
              </div>

              {/* Total Repaid */}
              <div className="bg-gray-900 text-white rounded-xl p-6">
                <p className="text-gray-400 text-sm mb-2">Total Repaid</p>
                <p className="text-3xl font-bold text-green-400">{formatCurrency(financialSummary.total_repaid)}</p>
              </div>

              {/* Risk Score */}
              <div className="bg-gray-900 text-white rounded-xl p-6">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-gray-400 text-sm">Internal Risk Score</p>
                  <span className="text-xs text-gray-500">/ 20.00</span>
                </div>
                <div className="flex items-end gap-2">
                  <p className={`text-4xl font-bold ${getRiskScoreColor(financialSummary.risk_score)}`}>
                    {financialSummary.risk_score.toFixed(2)}
                  </p>
                  <span className={`text-sm font-medium ${getRiskScoreColor(financialSummary.risk_score)} mb-2`}>
                    {getRiskLabel(financialSummary.risk_score)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Additional Details */}
          {user.role === 'customer' && financialSummary && (
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h4 className="font-semibold mb-4 text-gray-900">Loan Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Outstanding Balance</p>
                  <p className="text-lg font-bold text-red-600">
                    {formatCurrency(financialSummary.outstanding_balance)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Loans</p>
                  <p className="text-lg font-bold">{financialSummary.total_loans}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active Loans</p>
                  <p className="text-lg font-bold text-blue-600">{financialSummary.active_loans}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Defaults</p>
                  <p className="text-lg font-bold text-orange-600">{financialSummary.defaults_count}</p>
                </div>
              </div>
            </div>
          )}

          {/* User Information */}
          <div className="bg-white border rounded-xl p-6">
            <h4 className="font-semibold mb-4 text-gray-900">User Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-gray-500">Role</p>
                <p className="font-medium capitalize">{user.role.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-gray-500">Status</p>
                <p className="font-medium capitalize">{user.status}</p>
              </div>
              <div>
                <p className="text-gray-500">Member Since</p>
                <p className="font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
              </div>
              {user.phone && (
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium">{user.phone}</p>
                </div>
              )}
              {user.address && (
                <div className="col-span-2">
                  <p className="text-gray-500">Address</p>
                  <p className="font-medium">{user.address}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}