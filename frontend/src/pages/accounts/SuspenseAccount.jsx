import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, X, Link as LinkIcon, RotateCcw, Trash2, Search } from 'lucide-react'
import api from '../../api/client'
import { getUsers } from '../../api/users'
import client from '../../api/client'

export default function SuspenseAccount() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [payments, setPayments] = useState([])
  const [stats, setStats] = useState({ unmatched_balance: 0, unmatched_count: 0 })
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showMatchModal, setShowMatchModal] = useState(null)
  const [showReverseModal, setShowReverseModal] = useState(null)
  const [filterStatus, setFilterStatus] = useState('unmatched')
  const [customers, setCustomers] = useState([])
  const [customerLoans, setCustomerLoans] = useState([])
  
  const [formData, setFormData] = useState({
    amount: '',
    payment_method: 'cash',
    payment_date: new Date().toISOString().slice(0, 16),
    reference_number: '',
    payer_info: '',
    notes: ''
  })
  
  const [matchData, setMatchData] = useState({
    customer_id: '',
    loan_id: ''
  })
  
  const [reverseData, setReverseData] = useState({
    reason: ''
  })

  const canRecord = ['admin', 'manager', 'loan_officer'].includes(user?.role)
  const canMatch = ['admin', 'manager'].includes(user?.role)

  useEffect(() => {
    loadData()
    loadCustomers()
  }, [filterStatus])

  const loadData = async () => {
    setLoading(true)
    try {
      const showMatched = filterStatus === 'matched'
      const showReversed = filterStatus === 'reversed'
      
      const [paymentsRes, statsRes] = await Promise.all([
        client.get(`/suspense/?show_matched=${showMatched}&show_reversed=${showReversed}`),
        client.get('/suspense/stats')
      ])
      setPayments(paymentsRes.data)
      setStats(statsRes.data)
    } catch (error) {
      console.error('Failed to load suspense data:', error)
      toast.error('Failed to load suspense account')
    } finally {
      setLoading(false)
    }
  }

  const loadCustomers = async () => {
    try {
      const data = await getUsers('customer')
      setCustomers(data)
    } catch (error) {
      console.error('Failed to load customers:', error)
    }
  }

  const loadCustomerLoans = async (customerId) => {
    try {
      const response = await client.get(`/applications/user/${customerId}`)
      // Filter only disbursed loans
      const disbursed = response.data.filter(loan => loan.status === 'disbursed')
      setCustomerLoans(disbursed)
    } catch (error) {
      console.error('Failed to load customer loans:', error)
      setCustomerLoans([])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await client.post('/suspense/', {
        ...formData,
        amount: parseFloat(formData.amount)
      })
      toast.success('Suspense payment recorded!')
      setShowModal(false)
      setFormData({
        amount: '',
        payment_method: 'cash',
        payment_date: new Date().toISOString().slice(0, 16),
        reference_number: '',
        payer_info: '',
        notes: ''
      })
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment')
    }
  }

  const handleMatch = async (e) => {
    e.preventDefault()
    try {
      await client.post(`/suspense/${showMatchModal.id}/match`, {
        customer_id: parseInt(matchData.customer_id),
        loan_id: parseInt(matchData.loan_id)
      })
      toast.success('Payment matched and transferred successfully!')
      setShowMatchModal(null)
      setMatchData({ customer_id: '', loan_id: '' })
      setCustomerLoans([])
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to match payment')
    }
  }

  const handleReverse = async () => {
    try {
      await client.post(`/suspense/${showReverseModal.id}/reverse`, reverseData)
      toast.success('Payment reversed!')
      setShowReverseModal(null)
      setReverseData({ reason: '' })
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reverse payment')
    }
  }

  const handleDelete = async (paymentId) => {
    if (!confirm('Delete this suspense payment?')) return
    try {
      await client.delete(`/suspense/${paymentId}`)
      toast.success('Payment deleted')
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete')
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
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/accounts')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ArrowLeft size={20} className="dark:text-white" />
            </button>
            <div>
              <h2 className="text-2xl font-bold dark:text-white">Suspense Account</h2>
              <p className="text-gray-600 dark:text-gray-400">Unidentified payments awaiting matching</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="unmatched">Unmatched Only</option>
              <option value="matched">Matched</option>
              <option value="reversed">Reversed</option>
            </select>
            {canRecord && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} />
                Add Payment
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-6 rounded-lg">
            <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Unmatched Balance</p>
            <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{formatCurrency(stats.unmatched_balance)}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-6 rounded-lg">
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Pending Matching</p>
            <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{stats.unmatched_count}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Matched</p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-300">{stats.matched_count || 0}</p>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Payer Info</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Method</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No suspense payments found
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {payment.payer_info || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-right text-purple-600 dark:text-purple-400">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 capitalize">
                      {payment.payment_method?.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {payment.reference_number || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {payment.reversed ? (
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs font-medium rounded-full">
                          Reversed
                        </span>
                      ) : payment.matched ? (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded-full">
                          Matched
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs font-medium rounded-full">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {!payment.matched && !payment.reversed && canMatch && (
                          <>
                            <button
                              onClick={() => setShowMatchModal(payment)}
                              className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                              title="Match to Customer"
                            >
                              <LinkIcon size={18} />
                            </button>
                            <button
                              onClick={() => setShowReverseModal(payment)}
                              className="p-1 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded"
                              title="Reverse Payment"
                            >
                              <RotateCcw size={18} />
                            </button>
                          </>
                        )}
                        {!payment.matched && user?.role === 'admin' && (
                          <button
                            onClick={() => handleDelete(payment.id)}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Record Unidentified Payment</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Amount (₦) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Payment Method *</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="mobile_money">Mobile Money</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Payment Date *</label>
                <input
                  type="datetime-local"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Reference Number</label>
                <input
                  type="text"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Transaction ID, receipt number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Payer Information</label>
                <input
                  type="text"
                  value={formData.payer_info}
                  onChange={(e) => setFormData({ ...formData, payer_info: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Any info about who made the payment"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  rows="2"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Match Payment Modal */}
      {showMatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Match Payment to Customer</h3>
              <button onClick={() => {
                setShowMatchModal(null)
                setMatchData({ customer_id: '', loan_id: '' })
                setCustomerLoans([])
              }} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
              <p className="text-sm text-purple-800 dark:text-purple-300">
                <strong>Amount:</strong> {formatCurrency(showMatchModal.amount)}
              </p>
              {showMatchModal.payer_info && (
                <p className="text-sm text-purple-800 dark:text-purple-300">
                  <strong>Payer Info:</strong> {showMatchModal.payer_info}
                </p>
              )}
            </div>

            <form onSubmit={handleMatch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Customer *</label>
                <select
                  value={matchData.customer_id}
                  onChange={(e) => {
                    setMatchData({ ...matchData, customer_id: e.target.value, loan_id: '' })
                    if (e.target.value) {
                      loadCustomerLoans(e.target.value)
                    } else {
                      setCustomerLoans([])
                    }
                  }}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">Select customer...</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.first_name} {customer.last_name} - {customer.email}
                    </option>
                  ))}
                </select>
              </div>

              {matchData.customer_id && (
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Loan *</label>
                  <select
                    value={matchData.loan_id}
                    onChange={(e) => setMatchData({ ...matchData, loan_id: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Select loan...</option>
                    {customerLoans.map(loan => (
                      <option key={loan.id} value={loan.id}>
                        {loan.application_number} - {formatCurrency(loan.requested_amount)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowMatchModal(null)
                    setMatchData({ customer_id: '', loan_id: '' })
                    setCustomerLoans([])
                  }}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Match & Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reverse Payment Modal */}
      {showReverseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Reverse Payment</h3>
              <button onClick={() => setShowReverseModal(null)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 rounded-lg">
                <p className="text-sm text-orange-800 dark:text-orange-300">
                  <strong>Amount:</strong> {formatCurrency(showReverseModal.amount)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Reason for Reversal *</label>
                <textarea
                  value={reverseData.reason}
                  onChange={(e) => setReverseData({ reason: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  rows="3"
                  placeholder="Why is this payment being reversed?"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowReverseModal(null)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReverse}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Reverse Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}