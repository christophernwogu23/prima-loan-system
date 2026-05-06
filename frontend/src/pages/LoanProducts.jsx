import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getLoanProducts, deleteLoanProduct } from '../api/loanProducts'
import { useAuthStore } from '../store/authStore'
import { Trash2, Percent, Clock, DollarSign, Tag, AlertCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount || 0)

const INTEREST_TYPE_LABELS = {
  flat: 'Flat Rate',
  reducing: 'Reducing Balance',
  compound: 'Compound',
}

const FREQUENCY_LABELS = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  biweekly: 'Bi-Weekly',
  quarterly: 'Quarterly',
  annually: 'Annually',
}

export default function LoanProducts() {
  const { user } = useAuthStore()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const canDelete = ['admin', 'ceo'].includes(user?.role)

  useEffect(() => { loadProducts() }, [])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const data = await getLoanProducts()
      setProducts(data)
    } catch {
      toast.error('Failed to load loan products')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await deleteLoanProduct(deleteModal.id)
      toast.success(`"${deleteModal.name}" deleted successfully`)
      setDeleteModal(null)
      loadProducts()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete. Product may be in use.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">Loan Products</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">All available loan product configurations</p>
          </div>
          <button onClick={loadProducts}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* ── Summary ── */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Products</p>
              <p className="text-2xl font-bold dark:text-white">{products.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Active</p>
              <p className="text-2xl font-bold text-green-600">{products.filter(p => p.is_active).length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Lowest Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {Math.min(...products.map(p => p.interest_rate))}%
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Highest Rate</p>
              <p className="text-2xl font-bold text-orange-600">
                {Math.max(...products.map(p => p.interest_rate))}%
              </p>
            </div>
          </div>
        )}

        {/* ── Products Grid ── */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-10 text-center">
            <p className="text-gray-400">No loan products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map(product => (
              <div key={product.id}
                className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">

                {/* Card Header */}
                <div className="px-5 pt-5 pb-4 border-b dark:border-gray-700">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold dark:text-white">{product.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          product.is_active
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {product.code && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Tag size={11} /> {product.code}
                        </div>
                      )}
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => setDeleteModal(product)}
                        className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors flex-shrink-0"
                        title="Delete product">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {product.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{product.description}</p>
                  )}
                </div>

                {/* Card Body */}
                <div className="px-5 py-4 space-y-3">
                  {/* Interest Rate — prominently shown */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Percent size={15} className="text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Interest Rate</span>
                    </div>
                    <span className="text-xl font-bold text-blue-700 dark:text-blue-300">{product.interest_rate}%</span>
                  </div>

                  {/* Amount Range */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <DollarSign size={14} />
                      <span>Loan Amount</span>
                    </div>
                    <span className="text-sm font-medium dark:text-white">
                      {formatCurrency(product.min_amount)} – {formatCurrency(product.max_amount)}
                    </span>
                  </div>

                  {/* Tenure Range */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Clock size={14} />
                      <span>Tenure</span>
                    </div>
                    <span className="text-sm font-medium dark:text-white">
                      {product.min_tenure_months} – {product.max_tenure_months} months
                    </span>
                  </div>

                  {/* Interest Type */}
                  {product.interest_type && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Interest Type</span>
                      <span className="text-sm font-medium dark:text-white">
                        {INTEREST_TYPE_LABELS[product.interest_type] || product.interest_type}
                      </span>
                    </div>
                  )}

                  {/* Repayment Frequency */}
                  {product.repayment_frequency && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Repayment</span>
                      <span className="text-sm font-medium dark:text-white">
                        {FREQUENCY_LABELS[product.repayment_frequency] || product.repayment_frequency}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          Delete Confirmation Modal
      ══════════════════════════════════════ */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg flex-shrink-0">
                <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold dark:text-white">Delete Loan Product</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Are you sure you want to delete <strong className="dark:text-white">"{deleteModal.name}"</strong>?
                  This cannot be undone. Products linked to existing applications cannot be deleted.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} disabled={deleting}
                className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium">
                {deleting ? 'Deleting...' : 'Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}