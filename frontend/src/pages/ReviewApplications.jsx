import { useState, useEffect } from 'react'
import client from '../api/client'
import Layout from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import { getApplications, deleteApplication, updateApplication, reviewApplication } from '../api/applications'
import toast from 'react-hot-toast'
import { Eye, Edit2, Trash2, X, DollarSign, Users, CheckCircle, XCircle, Search, RefreshCw } from 'lucide-react'

export default function ReviewApplications() {
  const { user } = useAuthStore()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [searchQuery, setSearchQuery] = useState('')  // NEW
  const [viewModal, setViewModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [reviewComments, setReviewComments] = useState('')
  const [reviewAction, setReviewAction] = useState(null)

  const canModify = user?.role === 'admin' || user?.role === 'ceo'

  const canReview = (app) => {
    if (user?.role === 'loan_officer' && app.status === 'submitted') return true
    if (user?.role === 'manager' && ['officer_approved', 'officer_rejected'].includes(app.status)) return true
    if (user?.role === 'ceo' && app.status === 'manager_approved') return true
    return false
  }

  const generateMonthOptions = () => {
    const months = [{ value: '', label: 'All Time' }]
    const now = new Date()
    const seen = new Set()
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = date.toISOString().slice(0, 7)
      
      if (seen.has(value)) continue
      seen.add(value)
      
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      months.push({ value, label })
    }
    return months
  }

  const monthOptions = generateMonthOptions()

  useEffect(() => {
    const timer = setTimeout(() => {
      loadApplications()
    }, 300)
    return () => clearTimeout(timer)
  }, [selectedMonth, searchQuery])  // UPDATED - added searchQuery

  const loadApplications = async () => {
    setLoading(true)
    try {
      // Updated API call with search parameter
      const params = []
      if (selectedMonth) params.push(`month=${selectedMonth}`)
      if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`)
      
      let url = '/applications/'
      if (params.length > 0) {
        url += `?${params.join('&')}`
      }
      
      const { data } = await client.get(url)
      setApplications(data)
    } catch (error) {
      console.error('Failed to load applications:', error)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (action) => {
    if (!viewModal) return

    setReviewAction(action)
    setUpdating(true)

    try {
      await reviewApplication(viewModal.id, {
        action: action,
        comments: reviewComments || null
      })
      
      toast.success(`Application ${action === 'approve' ? 'approved' : 'rejected'} successfully!`)
      setViewModal(null)
      setReviewComments('')
      setReviewAction(null)
      loadApplications()
    } catch (error) {
      console.error('Failed to review application:', error)
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
      purpose: app.purpose || ''
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
        purpose: editModal.purpose
      })
      toast.success('Application updated successfully!')
      setEditModal(null)
      loadApplications()
    } catch (error) {
      console.error('Failed to update application:', error)
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
      console.error('Failed to delete application:', error)
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
      submitted: 'Submitted',
      officer_approved: 'Officer Approved',
      officer_rejected: 'Officer Rejected',
      manager_approved: 'Manager Approved',
      rejected: 'Rejected',
      disbursed: 'Disbursed'
    }
    return labels[status] || status
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
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">All Applications</h2>
            <p className="text-gray-600 dark:text-gray-400">View and manage loan applications</p>
          </div>
          
          <button
            onClick={loadApplications}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            title="Refresh"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 flex-wrap">
          {/* Search Bar */}
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by customer name or application number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Month Filter */}
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm mb-1">
                  Total Amount Requested {selectedMonth ? `(${monthOptions.find(m => m.value === selectedMonth)?.label})` : '(All Time)'}
                </p>
                <p className="text-3xl font-bold">
                  {formatCurrency(applications.reduce((sum, app) => sum + app.requested_amount, 0))}
                </p>
              </div>
              <div className="p-4 bg-white/20 rounded-lg">
                <DollarSign size={32} />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm mb-1">
                  Total Applications {selectedMonth ? `(${monthOptions.find(m => m.value === selectedMonth)?.label})` : '(All Time)'}
                </p>
                <p className="text-3xl font-bold">{applications.length}</p>
                <p className="text-white/80 text-xs mt-1">
                  From {new Set(applications.map(app => app.customer_id)).size} unique customers
                </p>
              </div>
              <div className="p-4 bg-white/20 rounded-lg">
                <Users size={32} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-2xl font-bold dark:text-white">{applications.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Submitted</p>
            <p className="text-2xl font-bold text-yellow-600">
              {applications.filter(app => app.status === 'submitted').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Disbursed</p>
            <p className="text-2xl font-bold text-green-600">
              {applications.filter(app => app.status === 'disbursed').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Rejected</p>
            <p className="text-2xl font-bold text-red-600">
              {applications.filter(app => app.status === 'rejected').length}
            </p>
          </div>
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
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 font-medium dark:text-white">{app.application_number}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {app.customer_name || `Customer #${app.customer_id}`}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {app.product_name || `Product #${app.loan_product_id}`}
                    </td>
                    <td className="px-6 py-4 dark:text-white">{formatCurrency(app.requested_amount)}</td>
                    <td className="px-6 py-4 dark:text-gray-300">{app.tenure_months}m</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                        {getStatusLabel(app.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setViewModal(app)
                            setReviewComments('')
                          }}
                          className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                          title="View"
                        >
                          <Eye size={18} />
                        </button>
                        {canModify && (
                          <>
                            <button
                              onClick={() => handleEdit(app)}
                              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => setDeleteModal(app)}
                              className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                              title="Delete"
                            >
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

      {/* Keep all your existing modals (View, Edit, Delete) - just add missing import for api */}
      {/* I'll show the View modal update with customer name: */}
      
      {viewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold dark:text-white">Application Details</h3>
              <button onClick={() => setViewModal(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Application Number</p>
                  <p className="font-semibold dark:text-white">{viewModal.application_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(viewModal.status)}`}>
                    {getStatusLabel(viewModal.status)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                  <p className="font-semibold dark:text-white">{viewModal.customer_name || `Customer #${viewModal.customer_id}`}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Product</p>
                  <p className="font-semibold dark:text-white">{viewModal.product_name || `Product #${viewModal.loan_product_id}`}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Amount Requested</p>
                  <p className="font-semibold dark:text-white">{formatCurrency(viewModal.requested_amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Approved Amount</p>
                  <p className="font-semibold dark:text-white">{viewModal.approved_amount ? formatCurrency(viewModal.approved_amount) : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tenure</p>
                  <p className="font-semibold dark:text-white">{viewModal.tenure_months} months</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Applied On</p>
                  <p className="font-semibold dark:text-white">{new Date(viewModal.created_at).toLocaleDateString()}</p>
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
                  {viewModal.officer_comments && (
                    <div className="text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded mb-2">
                      <span className="font-medium dark:text-white">Loan Officer:</span> <span className="dark:text-gray-300">{viewModal.officer_comments}</span>
                    </div>
                  )}
                  {viewModal.manager_comments && (
                    <div className="text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded mb-2">
                      <span className="font-medium dark:text-white">Manager:</span> <span className="dark:text-gray-300">{viewModal.manager_comments}</span>
                    </div>
                  )}
                  {viewModal.ceo_comments && (
                    <div className="text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded">
                      <span className="font-medium dark:text-white">CEO:</span> <span className="dark:text-gray-300">{viewModal.ceo_comments}</span>
                    </div>
                  )}
                </div>
              )}

              {canReview(viewModal) && (
                <div className="border-t dark:border-gray-700 pt-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Your Review</p>
                  <textarea
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    placeholder="Add your comments (optional)"
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white mb-3"
                    rows="3"
                  />
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReview('approve')}
                      disabled={updating}
                      className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {reviewAction === 'approve' ? 'Approving...' : (
                        <>
                          <CheckCircle size={16} />
                          Approve
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleReview('reject')}
                      disabled={updating}
                      className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {reviewAction === 'reject' ? 'Rejecting...' : (
                        <>
                          <XCircle size={16} />
                          Reject
                        </>
                      )}
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
            <div className="border-b dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold dark:text-white">Edit Application</h3>
              <button 
                onClick={() => setEditModal(null)} 
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Requested Amount (₦)
                </label>
                <input
                  type="number"
                  value={editModal.requested_amount}
                  onChange={(e) => setEditModal({...editModal, requested_amount: e.target.value})}
                  className="w-full border dark:border-gray-600 border-gray-300 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Approved Amount (₦) <span className="text-gray-400 dark:text-gray-500">(optional)</span>
                </label>
                <input
                  type="number"
                  value={editModal.approved_amount}
                  onChange={(e) => setEditModal({...editModal, approved_amount: e.target.value})}
                  className="w-full border dark:border-gray-600 border-gray-300 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tenure (months)
                </label>
                <input
                  type="number"
                  value={editModal.tenure_months}
                  onChange={(e) => setEditModal({...editModal, tenure_months: e.target.value})}
                  className="w-full border dark:border-gray-600 border-gray-300 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={editModal.status}
                  onChange={(e) => setEditModal({...editModal, status: e.target.value})}
                  className="w-full border dark:border-gray-600 border-gray-300 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="submitted">Submitted</option>
                  <option value="officer_approved">Officer Approved</option>
                  <option value="officer_rejected">Officer Rejected</option>
                  <option value="manager_approved">Manager Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="disbursed">Disbursed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Purpose
                </label>
                <textarea
                  value={editModal.purpose}
                  onChange={(e) => setEditModal({...editModal, purpose: e.target.value})}
                  className="w-full border dark:border-gray-600 border-gray-300 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors"
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {updating ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Delete Application</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete application <strong className="dark:text-white">{deleteModal.application_number}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 px-4 py-2 border dark:border-gray-600 border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
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
      
   