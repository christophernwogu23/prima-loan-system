import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getPayments, createPayment, updatePayment, deletePayment, getDisbursedLoans, getPaymentSummary } from '../api/payments'
import { DollarSign, Plus, X, CreditCard, Building, Banknote, Smartphone, Wallet, Eye, Edit2, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Building },
  { value: 'cheque', label: 'Cheque', icon: CreditCard },
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
  { value: 'savings_account', label: 'Savings Account', icon: Wallet }
]

export default function Payments() {
  const { user } = useAuthStore()
  const [payments, setPayments] = useState([])
  const [disbursedLoans, setDisbursedLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [viewModal, setViewModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [loanSummary, setLoanSummary] = useState(null)
  const [loanSearchQuery, setLoanSearchQuery] = useState('')
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('')  // NEW - for main page search
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  const [formData, setFormData] = useState({
    loan_application_id: '',
    amount: '',
    payment_method: 'cash',
    reference_number: '',
    notes: ''
  })

  const canRecordPayments = ['admin', 'manager', 'loan_officer'].includes(user?.role)
  const canModify = ['admin', 'ceo'].includes(user?.role)
  const canViewLoans = ['admin', 'manager', 'loan_officer', 'ceo'].includes(user?.role)

  const generateMonthOptions = () => {
    const months = [{ value: '', label: 'All Time' }]
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = date.toISOString().slice(0, 7)
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      months.push({ value, label })
    }
    return months
  }

  const monthOptions = generateMonthOptions()

  useEffect(() => {
    loadData()
  }, [selectedMonth])

  const loadData = async () => {
    setLoading(true)
    try {
      const [paymentsData, loansData] = await Promise.all([
        getPayments(selectedMonth || null),
        canViewLoans ? getDisbursedLoans() : Promise.resolve([])
      ])
      setPayments(paymentsData)
      setDisbursedLoans(loansData)
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }

  const handleLoanSelect = async (e) => {
    const loanId = e.target.value
    setFormData({ ...formData, loan_application_id: loanId })
    
    if (loanId) {
      const loan = disbursedLoans.find(l => l.id === parseInt(loanId))
      setSelectedLoan(loan)
      try {
        const summary = await getPaymentSummary(loanId)
        setLoanSummary(summary)
      } catch (error) {
        console.error('Failed to load summary:', error)
      }
    } else {
      setSelectedLoan(null)
      setLoanSummary(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.loan_application_id || !formData.amount) {
      toast.error('Please select a loan and enter amount')
      return
    }

    try {
      await createPayment({
        ...formData,
        loan_application_id: parseInt(formData.loan_application_id),
        amount: parseFloat(formData.amount)
      })
      toast.success('Payment recorded!')
      setShowModal(false)
      setFormData({
        loan_application_id: '',
        amount: '',
        payment_method: 'cash',
        reference_number: '',
        notes: ''
      })
      setSelectedLoan(null)
      setLoanSummary(null)
      setLoanSearchQuery('')
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment')
    }
  }

  const handleEdit = (payment) => {
    setEditModal({
      id: payment.id,
      amount: payment.amount,
      payment_method: payment.payment_method,
      reference_number: payment.reference_number || '',
      notes: payment.notes || ''
    })
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editModal) return

    setUpdating(true)
    try {
      await updatePayment(editModal.id, {
        amount: parseFloat(editModal.amount),
        payment_method: editModal.payment_method,
        reference_number: editModal.reference_number,
        notes: editModal.notes
      })
      toast.success('Payment updated!')
      setEditModal(null)
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    
    setDeleting(true)
    try {
      await deletePayment(deleteModal.id)
      toast.success('Payment deleted!')
      setDeleteModal(null)
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete')
    } finally {
      setDeleting(false)
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

  const getMethodIcon = (method) => {
    const methodObj = PAYMENT_METHODS.find(m => m.value === method)
    return methodObj ? methodObj.icon : DollarSign
  }

  // Filter loans for the modal dropdown
  const filteredLoans = disbursedLoans.filter(loan => {
    if (!loanSearchQuery) return true
    const searchLower = loanSearchQuery.toLowerCase()
    return (
      loan.customer_name.toLowerCase().includes(searchLower) ||
      loan.product_name.toLowerCase().includes(searchLower) ||
      loan.id.toString().includes(searchLower)
    )
  })

  // Filter payments for the main table
  const filteredPayments = payments.filter(payment => {
    if (!paymentSearchQuery) return true
    const searchLower = paymentSearchQuery.toLowerCase()
    return (
      payment.customer_name?.toLowerCase().includes(searchLower) ||
      payment.loan_product_name?.toLowerCase().includes(searchLower) ||
      payment.reference_number?.toLowerCase().includes(searchLower) ||
      payment.payment_method?.toLowerCase().includes(searchLower)
    )
  })

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payments</h1>
            <p className="text-gray-600 dark:text-gray-400">Track and record loan payments</p>
          </div>
          {canRecordPayments && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} />
              Record Payment
            </button>
          )}
        </div>

        {/* Search and Filter Bar */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by customer, product, reference, or method..."
              value={paymentSearchQuery}
              onChange={(e) => setPaymentSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            {paymentSearchQuery && (
              <button
                onClick={() => setPaymentSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        {paymentSearchQuery && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Found {filteredPayments.length} {filteredPayments.length === 1 ? 'payment' : 'payments'}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-6 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Collected</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-6 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Payments</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{payments.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-6 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Building className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Loans</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{disbursedLoans.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Loan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Reference</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    {paymentSearchQuery ? 'No payments found matching your search.' : 'No payments recorded yet'}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const MethodIcon = getMethodIcon(payment.payment_method)
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm dark:text-white">{formatDate(payment.payment_date)}</td>
                      <td className="px-6 py-4 text-sm dark:text-white">{payment.customer_name}</td>
                      <td className="px-6 py-4 text-sm dark:text-gray-300">
                        {payment.loan_product_name}
                        <span className="text-gray-400 ml-1">({formatCurrency(payment.loan_amount)})</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MethodIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm dark:text-gray-300 capitalize">
                            {payment.payment_method?.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {payment.reference_number || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-green-600 dark:text-green-400 text-right">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setViewModal(payment)}
                            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                          >
                            <Eye size={18} />
                          </button>
                          {canModify && (
                            <>
                              <button
                                onClick={() => handleEdit(payment)}
                                className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => setDeleteModal(payment)}
                                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">Record Payment</h2>
              <button onClick={() => {
                setShowModal(false)
                setLoanSearchQuery('')
              }} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Loan *
                </label>
                
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search customer, loan ID, or product..."
                    value={loanSearchQuery}
                    onChange={(e) => setLoanSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <select
                  value={formData.loan_application_id}
                  onChange={handleLoanSelect}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
                  size="5"
                  required
                >
                  <option value="">Choose a loan...</option>
                  {filteredLoans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.customer_name} - {loan.product_name} ({formatCurrency(loan.amount)})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Showing {filteredLoans.length} of {disbursedLoans.length} loans
                </p>
              </div>

              {loanSummary && (
                <div className="bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 p-3 rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Loan Amount:</span>
                    <span className="font-medium dark:text-white">{formatCurrency(loanSummary.loan_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Paid:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(loanSummary.total_paid)}</span>
                  </div>
                  <div className="flex justify-between border-t dark:border-gray-600 mt-2 pt-2">
                    <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(loanSummary.remaining_balance)}</span>
                  </div>
                </div>
              )}

              {selectedLoan && formData.payment_method === 'savings_account' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg text-sm">
                  <p className="text-yellow-800 dark:text-yellow-300">
                    <strong>Note:</strong> Payment will be deducted from customer's savings account.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount (₦) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Method *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, payment_method: method.value })}
                        className={`flex items-center gap-2 p-3 border rounded-lg ${
                          formData.payment_method === method.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:text-gray-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{method.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
                  placeholder="Transaction ID, cheque number, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
                  rows="2"
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setLoanSearchQuery('')
                  }}
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

      {/* Keep all existing modals (View, Edit, Delete) exactly as before */}
      {viewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
            <div className="border-b dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold dark:text-white">Payment Details</h3>
              <button onClick={() => setViewModal(null)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Payment Date</p>
                  <p className="font-semibold dark:text-white">{formatDate(viewModal.payment_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Amount</p>
                  <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(viewModal.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                  <p className="font-semibold dark:text-white">{viewModal.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Method</p>
                  <p className="font-semibold dark:text-white capitalize">{viewModal.payment_method?.replace('_', ' ')}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loan</p>
                  <p className="font-semibold dark:text-white">{viewModal.loan_product_name} - {formatCurrency(viewModal.loan_amount)}</p>
                </div>
                {viewModal.reference_number && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Reference</p>
                    <p className="font-semibold dark:text-white">{viewModal.reference_number}</p>
                  </div>
                )}
                {viewModal.notes && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Notes</p>
                    <p className="text-sm mt-1 dark:text-gray-300">{viewModal.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg">
            <div className="border-b dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold dark:text-white">Edit Payment</h3>
              <button onClick={() => setEditModal(null)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Amount (₦)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editModal.amount}
                  onChange={(e) => setEditModal({...editModal, amount: e.target.value})}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Method</label>
                <select
                  value={editModal.payment_method}
                  onChange={(e) => setEditModal({...editModal, payment_method: e.target.value})}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
                  required
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Reference</label>
                <input
                  type="text"
                  value={editModal.reference_number}
                  onChange={(e) => setEditModal({...editModal, reference_number: e.target.value})}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={editModal.notes}
                  onChange={(e) => setEditModal({...editModal, notes: e.target.value})}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
                  rows="3"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Delete Payment</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Delete payment of <strong className="dark:text-white">{formatCurrency(deleteModal.amount)}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}