import { useState, useEffect } from 'react'
import client from '../api/client'
import Layout from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { getApplications, deleteApplication, updateApplication, reviewApplication } from '../api/applications'
import toast from 'react-hot-toast'
import { Eye, Edit2, Trash2, X, DollarSign, Users, CheckCircle, XCircle, Search, RefreshCw, Plus, FileText, Calendar } from 'lucide-react'

export default function ReviewApplications() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewModal, setViewModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [reviewComments, setReviewComments] = useState('')
  const [reviewAction, setReviewAction] = useState(null)
  const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().split('T')[0])

  // Apply modal
  const [applyModal, setApplyModal] = useState(false)
  const [customers, setCustomers] = useState([])
  const [loanProducts, setLoanProducts] = useState([])
  const [applyForm, setApplyForm] = useState({
    customer_id: '', loan_product_id: '', requested_amount: '', tenure_months: '', purpose: ''
  })
  const [applying, setApplying] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  const canModify = ['admin', 'ceo', 'manager'].includes(user?.role)
  const canApplyForCustomer = ['loan_officer', 'manager', 'admin'].includes(user?.role)
  const isCEO = user?.role === 'ceo'

  const canReview = (app) => {
    if (user?.role === 'loan_officer' && app.status === 'submitted') return true
    if (user?.role === 'manager' && ['officer_approved', 'officer_rejected'].includes(app.status)) return true
    if (user?.role === 'ceo' && app.status === 'manager_approved') return true
    return false
  }

  const canGenerateLetter = (status) => ['manager_approved', 'disbursed'].includes(status)

  const generateMonthOptions = () => {
    const months = [{ value: '', label: 'All Time' }]
    const now = new Date()
    const seen = new Set()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = date.toISOString().slice(0, 7)
      if (seen.has(value)) continue
      seen.add(value)
      months.push({ value, label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) })
    }
    return months
  }

  const monthOptions = generateMonthOptions()

  useEffect(() => {
    const timer = setTimeout(() => loadApplications(), 300)
    return () => clearTimeout(timer)
  }, [selectedMonth, searchQuery])

  const loadApplications = async () => {
    setLoading(true)
    try {
      const params = []
      if (selectedMonth) params.push(`month=${selectedMonth}`)
      if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`)
      const { data } = await client.get(`/applications/${params.length ? '?' + params.join('&') : ''}`)
      setApplications(data)
    } catch (error) {
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const openApplyModal = async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        client.get('/users/?role=customer'),
        client.get('/loan-products/')
      ])
      setCustomers(custRes.data)
      setLoanProducts(prodRes.data)
      setApplyForm({ customer_id: '', loan_product_id: '', requested_amount: '', tenure_months: '', purpose: '' })
      setCustomerSearch('')
      setShowCustomerDropdown(false)
      setApplyModal(true)
    } catch (err) {
      toast.error('Failed to load customers or products')
    }
  }

  const handleApplyForCustomer = async (e) => {
    e.preventDefault()
    if (!applyForm.customer_id) return toast.error('Please select a customer')
    setApplying(true)
    try {
      await client.post('/applications/', {
        customer_id: parseInt(applyForm.customer_id),
        loan_product_id: parseInt(applyForm.loan_product_id),
        requested_amount: parseFloat(applyForm.requested_amount),
        tenure_months: parseInt(applyForm.tenure_months),
        purpose: applyForm.purpose || null
      })
      toast.success('Application submitted successfully!')
      setApplyModal(false)
      loadApplications()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit application')
    } finally {
      setApplying(false)
    }
  }

  const handleReview = async (action) => {
    if (!viewModal) return
    setReviewAction(action)
    setUpdating(true)
    try {
      const payload = { action, comments: reviewComments || null }
      // Only send disbursement_date when CEO is approving (disbursing)
      if (isCEO && action === 'approve') {
        payload.disbursement_date = disbursementDate
      }
      await reviewApplication(viewModal.id, payload)
      toast.success(`Application ${action === 'approve' ? 'approved' : 'rejected'} successfully!`)
      setViewModal(null)
      setReviewComments('')
      setReviewAction(null)
      setDisbursementDate(new Date().toISOString().split('T')[0])
      loadApplications()
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${action} application`)
    } finally {
      setUpdating(false)
      setReviewAction(null)
    }
  }

  const handleEdit = (app) => {
    setEditModal({
      id: app.id,
      requested_amount: app.requested_amount,
      approved_amount: app.approved_amount || '',
      tenure_months: app.tenure_months,
      status: app.status,
      purpose: app.purpose || '',
      created_at: app.created_at ? new Date(app.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    })
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editModal) return
    setUpdating(true)
    try {
      await updateApplication(editModal.id, {
        requested_amount: parseFloat(editModal.requested_amount),
        approved_amount: editModal.approved_amount ? parseFloat(editModal.approved_amount) : null,
        tenure_months: parseInt(editModal.tenure_months),
        status: editModal.status,
        purpose: editModal.purpose,
        created_at: editModal.created_at ? new Date(editModal.created_at).toISOString() : null,
        approved_at: editModal.created_at ? new Date(editModal.created_at).toISOString() : null,
      })
      toast.success('Application updated successfully!')
      setEditModal(null)
      loadApplications()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update application')
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await deleteApplication(deleteModal.id)
      toast.success('Application deleted successfully!')
      setDeleteModal(null)
      loadApplications()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete application')
    } finally {
      setDeleting(false)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      submitted: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      officer_approved: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      officer_rejected: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
      manager_approved: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
      rejected: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      disbursed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    }
    return colors[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
  }

  const getStatusLabel = (status) => {
    const labels = {
      submitted: 'Submitted', officer_approved: 'Officer Approved',
      officer_rejected: 'Officer Rejected', manager_approved: 'Manager Approved',
      rejected: 'Rejected', disbursed: 'Disbursed'
    }
    return labels[status] || status
  }

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount)

  const selectedCustomer = customers.find(c => c.id === parseInt(applyForm.customer_id))
  const filteredCustomers = customers.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(customerSearch.toLowerCase())
  )
  const customerInputValue = selectedCustomer
    ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
    : customerSearch

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">All Applications</h2>
            <p className="text-gray-600 dark:text-gray-400">View and manage loan applications</p>
          </div>
          <div className="flex gap-3">
            {canApplyForCustomer && (
              <button onClick={openApplyModal}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Plus size={18} /> Apply for Customer
              </button>
            )}
            <button onClick={loadApplications}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <RefreshCw size={18} /> Refresh
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input type="text" placeholder="Search by customer name or application number..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            )}
          </div>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm mb-1">Total Amount Requested</p>
                <p className="text-3xl font-bold">{formatCurrency(applications.reduce((sum, a) => sum + a.requested_amount, 0))}</p>
              </div>
              <div className="p-4 bg-white/20 rounded-lg"><DollarSign size={32} /></div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm mb-1">Total Applications</p>
                <p className="text-3xl font-bold">{applications.length}</p>
                <p className="text-white/80 text-xs mt-1">From {new Set(applications.map(a => a.customer_id)).size} unique customers</p>
              </div>
              <div className="p-4 bg-white/20 rounded-lg"><Users size={32} /></div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: applications.length, color: 'dark:text-white' },
            { label: 'Submitted', value: applications.filter(a => a.status === 'submitted').length, color: 'text-yellow-600' },
            { label: 'Disbursed', value: applications.filter(a => a.status === 'disbursed').length, color: 'text-green-600' },
            { label: 'Rejected', value: applications.filter(a => a.status === 'rejected').length, color: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No applications found matching your search.' : 'No applications found'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">App #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tenure</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {applications.map(app => (
                  <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 font-medium dark:text-white">{app.application_number}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{app.customer_name || `Customer #${app.customer_id}`}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{app.product_name || `Product #${app.loan_product_id}`}</td>
                    <td className="px-6 py-4 dark:text-white">{formatCurrency(app.requested_amount)}</td>
                    <td className="px-6 py-4 dark:text-gray-300">{app.tenure_months}m</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                        {getStatusLabel(app.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{new Date(app.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setViewModal(app); setReviewComments(''); setDisbursementDate(new Date().toISOString().split('T')[0]) }}
                          className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="View">
                          <Eye size={18} />
                        </button>
                        {canGenerateLetter(app.status) && (
                          <button onClick={() => navigate(`/applications/${app.id}/offer-letter`)}
                            className="p-1 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded" title="Offer Letter">
                            <FileText size={18} />
                          </button>
                        )}
                        {canModify && (
                          <>
                            <button onClick={() => handleEdit(app)}
                              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded" title="Edit">
                              <Edit2 size={18} />
                            </button>
                            <button onClick={() => setDeleteModal(app)}
                              className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Delete">
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply for Customer Modal */}
      {applyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Apply for Customer</h3>
              <button onClick={() => setApplyModal(false)} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <form onSubmit={handleApplyForCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Customer *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input type="text" placeholder="Search customer by name..."
                    value={customerInputValue}
                    onChange={e => { setCustomerSearch(e.target.value); setApplyForm({ ...applyForm, customer_id: '' }); setShowCustomerDropdown(true) }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full pl-9 pr-8 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
                  {applyForm.customer_id && (
                    <button type="button" onClick={() => { setApplyForm({ ...applyForm, customer_id: '' }); setCustomerSearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                  )}
                  {showCustomerDropdown && !applyForm.customer_id && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomers.length === 0
                        ? <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No customers found</p>
                        : filteredCustomers.map(c => (
                          <button key={c.id} type="button"
                            onClick={() => { setApplyForm({ ...applyForm, customer_id: String(c.id) }); setCustomerSearch(''); setShowCustomerDropdown(false) }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white">
                            {c.first_name} {c.last_name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                {applyForm.customer_id && <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ {selectedCustomer?.first_name} {selectedCustomer?.last_name} selected</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Loan Product *</label>
                <select value={applyForm.loan_product_id} onChange={e => setApplyForm({ ...applyForm, loan_product_id: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required>
                  <option value="">Select product...</option>
                  {loanProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Amount (₦) *</label>
                <input type="number" value={applyForm.requested_amount} onChange={e => setApplyForm({ ...applyForm, requested_amount: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" placeholder="0.00" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tenure (months) *</label>
                <input type="number" value={applyForm.tenure_months} onChange={e => setApplyForm({ ...applyForm, tenure_months: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" placeholder="e.g. 6" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Purpose</label>
                <textarea value={applyForm.purpose} onChange={e => setApplyForm({ ...applyForm, purpose: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" rows="2" placeholder="Optional..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setApplyModal(false)} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={applying} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {applying ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold dark:text-white">Application Details</h3>
              <button onClick={() => setViewModal(null)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Application Number', value: viewModal.application_number },
                  { label: 'Customer', value: viewModal.customer_name || `Customer #${viewModal.customer_id}` },
                  { label: 'Product', value: viewModal.product_name || `Product #${viewModal.loan_product_id}` },
                  { label: 'Amount Requested', value: formatCurrency(viewModal.requested_amount) },
                  { label: 'Approved Amount', value: viewModal.approved_amount ? formatCurrency(viewModal.approved_amount) : 'N/A' },
                  { label: 'Tenure', value: `${viewModal.tenure_months} months` },
                  { label: 'Applied On', value: new Date(viewModal.created_at).toLocaleDateString() },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{f.label}</p>
                    <p className="font-semibold dark:text-white">{f.value}</p>
                  </div>
                ))}
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(viewModal.status)}`}>
                    {getStatusLabel(viewModal.status)}
                  </span>
                </div>
              </div>

              {viewModal.purpose && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Purpose</p>
                  <p className="text-sm mt-1 dark:text-gray-300">{viewModal.purpose}</p>
                </div>
              )}

              {(viewModal.officer_comments || viewModal.manager_comments || viewModal.ceo_comments) && (
                <div className="border-t dark:border-gray-700 pt-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Review Comments</p>
                  {viewModal.officer_comments && <div className="text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded mb-2"><span className="font-medium dark:text-white">Loan Officer:</span> <span className="dark:text-gray-300">{viewModal.officer_comments}</span></div>}
                  {viewModal.manager_comments && <div className="text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded mb-2"><span className="font-medium dark:text-white">Manager:</span> <span className="dark:text-gray-300">{viewModal.manager_comments}</span></div>}
                  {viewModal.ceo_comments && <div className="text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded"><span className="font-medium dark:text-white">CEO:</span> <span className="dark:text-gray-300">{viewModal.ceo_comments}</span></div>}
                </div>
              )}

              {canGenerateLetter(viewModal.status) && (
                <div className="border-t dark:border-gray-700 pt-4">
                  <button onClick={() => navigate(`/applications/${viewModal.id}/offer-letter`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                    <FileText size={18} /> Generate Offer Letter
                  </button>
                </div>
              )}

              {canReview(viewModal) && (
                <div className="border-t dark:border-gray-700 pt-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Your Review</p>

                  {/* Disbursement Date — only shown to CEO when approving */}
                  {isCEO && viewModal.status === 'manager_approved' && (
                    <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <label className="flex items-center gap-2 text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                        <Calendar size={15} /> Disbursement Date
                      </label>
                      <input
                        type="date"
                        value={disbursementDate}
                        onChange={e => setDisbursementDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                      />
                      <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">Set a past date to backdate this disbursement</p>
                    </div>
                  )}

                  <textarea value={reviewComments} onChange={e => setReviewComments(e.target.value)}
                    placeholder="Add your comments (optional)"
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white mb-3" rows="3" />
                  <div className="flex gap-3">
                    <button onClick={() => handleReview('approve')} disabled={updating}
                      className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      {reviewAction === 'approve' ? 'Approving...' : <><CheckCircle size={16} />Approve</>}
                    </button>
                    <button onClick={() => handleReview('reject')} disabled={updating}
                      className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      {reviewAction === 'reject' ? 'Rejecting...' : <><XCircle size={16} />Reject</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="border-b dark:border-gray-700 px-6 py-4 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-lg font-semibold dark:text-white">Edit Application</h3>
              <button onClick={() => setEditModal(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {[
                { label: 'Requested Amount (₦)', key: 'requested_amount', type: 'number' },
                { label: 'Approved Amount (₦)', key: 'approved_amount', type: 'number' },
                { label: 'Tenure (months)', key: 'tenure_months', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                  <input type={f.type} value={editModal[f.key]} onChange={e => setEditModal({ ...editModal, [f.key]: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select value={editModal.status} onChange={e => setEditModal({ ...editModal, status: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white">
                  {['submitted','officer_approved','officer_rejected','manager_approved','rejected','disbursed'].map(s => (
                    <option key={s} value={s}>{getStatusLabel(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purpose</label>
                <textarea value={editModal.purpose} onChange={e => setEditModal({ ...editModal, purpose: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" rows="3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <Calendar size={14} /> Loan Date (Backdate)
                </label>
                <input
                  type="date"
                  value={editModal.created_at}
                  onChange={e => setEditModal({ ...editModal, created_at: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Change this to set the original disbursement date</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditModal(null)} disabled={updating}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white">Cancel</button>
                <button type="submit" disabled={updating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {updating ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Delete Application</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete application <strong className="dark:text-white">{deleteModal.application_number}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} disabled={deleting}
                className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}