import { useState, useEffect } from 'react'
import client from '../api/client'
import Layout from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import { Users, Plus, Edit2, Trash2, X, ArrowDownCircle, ArrowUpCircle, History } from 'lucide-react'
import toast from 'react-hot-toast'

const today = () => new Date().toISOString().split('T')[0]
const fmt = (amt) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amt || 0)
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export default function Shareholders() {
  const { user } = useAuthStore()
  const [shareholders, setShareholders] = useState([])
  const [summary, setSummary] = useState({ total_capital: 0, shareholder_count: 0, total_injections: 0, total_drawings: 0 })
  const [loading, setLoading] = useState(true)

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ name: '', capital: '', notes: '' })
  const [txnModal, setTxnModal] = useState(null)
  const [txnForm, setTxnForm] = useState({ amount: '', transaction_date: today(), notes: '' })
  const [historyModal, setHistoryModal] = useState(null)
  const [historyData, setHistoryData] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = user?.role === 'admin'
  const canEdit = ['admin', 'ceo', 'manager'].includes(user?.role)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [sRes, sumRes] = await Promise.all([
        client.get('/shareholders'),
        client.get('/shareholders/summary')
      ])
      setShareholders(sRes.data)
      setSummary(sumRes.data)
    } catch { toast.error('Failed to load shareholders') }
    finally { setLoading(false) }
  }

  const getOwnershipPercent = (capital) =>
    summary.total_capital === 0 ? '0.00' : ((capital / summary.total_capital) * 100).toFixed(2)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = { name: formData.name, capital: parseFloat(formData.capital), notes: formData.notes || null }
      if (editingId) {
        await client.put(`/shareholders/${editingId}`, payload)
        toast.success('Shareholder updated!')
      } else {
        await client.post('/shareholders', payload)
        toast.success('Shareholder added!')
      }
      setShowModal(false)
      setEditingId(null)
      setFormData({ name: '', capital: '', notes: '' })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save shareholder')
    }
  }

  const handleEdit = (s) => {
    setEditingId(s.id)
    setFormData({ name: s.name, capital: s.capital.toString(), notes: s.notes || '' })
    setShowModal(true)
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await client.delete(`/shareholders/${deleteModal.id}`)
      toast.success('Shareholder deleted')
      setDeleteModal(null)
      fetchData()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete') }
    finally { setDeleting(false) }
  }

  const openTxnModal = (shareholder, type) => {
    setTxnModal({ shareholder, type })
    setTxnForm({ amount: '', transaction_date: today(), notes: '' })
  }

  const handleTxnSubmit = async (e) => {
    e.preventDefault()
    if (!txnForm.amount || parseFloat(txnForm.amount) <= 0) return toast.error('Enter a valid amount')
    setSubmitting(true)
    try {
      const res = await client.post(`/shareholders/${txnModal.shareholder.id}/transactions`, {
        transaction_type: txnModal.type,
        amount: parseFloat(txnForm.amount),
        transaction_date: txnForm.transaction_date,
        notes: txnForm.notes || null
      })
      toast.success(`${txnModal.type === 'injection' ? 'Capital injection' : 'Drawing'} recorded! New capital: ${fmt(res.data.new_capital)}`)
      setTxnModal(null)
      fetchData()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to record transaction') }
    finally { setSubmitting(false) }
  }

  const openHistory = async (shareholder) => {
    setHistoryModal(shareholder)
    setHistoryData(null)
    try {
      const res = await client.get(`/shareholders/${shareholder.id}/transactions`)
      setHistoryData(res.data)
    } catch { toast.error('Failed to load history') }
  }

  if (loading) return (
    <Layout>
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shareholders</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage shareholder capital, injections and drawings</p>
          </div>
          {canEdit && (
            <button onClick={() => { setEditingId(null); setFormData({ name: '', capital: '', notes: '' }); setShowModal(true) }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add Shareholder
            </button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Shareholders', value: summary.shareholder_count, color: 'blue' },
            { label: 'Total Capital', value: fmt(summary.total_capital), color: 'green' },
            { label: 'Total Injections', value: fmt(summary.total_injections), color: 'purple' },
            { label: 'Total Drawings', value: fmt(summary.total_drawings), color: 'orange' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-4">
              <p className={`text-sm text-${s.color}-600 dark:text-${s.color}-400 font-medium`}>{s.label}</p>
              <p className="text-xl font-bold dark:text-white mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {['Name', 'Capital', 'Ownership %', 'Notes', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {shareholders.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No shareholders found.</td></tr>
              ) : shareholders.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 font-medium dark:text-white">{s.name}</td>
                  <td className="px-6 py-4 dark:text-white">{fmt(s.capital)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(getOwnershipPercent(s.capital), 100)}%` }} />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{getOwnershipPercent(s.capital)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{s.notes || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button onClick={() => openTxnModal(s, 'injection')}
                          className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded" title="Capital Injection">
                          <ArrowDownCircle size={16} />
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => openTxnModal(s, 'drawing')}
                          className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded" title="Drawing">
                          <ArrowUpCircle size={16} />
                        </button>
                      )}
                      <button onClick={() => openHistory(s)}
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Transaction History">
                        <History size={16} />
                      </button>
                      {canEdit && (
                        <button onClick={() => handleEdit(s)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                          <Edit2 size={16} />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => setDeleteModal(s)}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">{editingId ? 'Edit' : 'Add'} Shareholder</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Capital (₦) *</label>
                <input type="number" step="0.01" min="0" value={formData.capital} onChange={e => setFormData({ ...formData, capital: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" rows="2" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {txnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                {txnModal.type === 'injection'
                  ? <ArrowDownCircle className="w-6 h-6 text-green-600" />
                  : <ArrowUpCircle className="w-6 h-6 text-orange-600" />}
                <h3 className="text-lg font-semibold dark:text-white">
                  {txnModal.type === 'injection' ? 'Capital Injection' : 'Drawing'} — {txnModal.shareholder.name}
                </h3>
              </div>
              <button onClick={() => setTxnModal(null)} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Capital</p>
              <p className="text-xl font-bold dark:text-white">{fmt(txnModal.shareholder.capital)}</p>
            </div>

            {txnModal.type === 'drawing' && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-orange-800 dark:text-orange-300">
                  Drawing will reduce the shareholder's capital balance. Cannot exceed current capital.
                </p>
              </div>
            )}

            <form onSubmit={handleTxnSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Amount (₦) *</label>
                <input type="number" step="0.01" value={txnForm.amount}
                  onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="0.00" required autoFocus />
                {txnModal.type === 'drawing' && txnForm.amount && parseFloat(txnForm.amount) > txnModal.shareholder.capital && (
                  <p className="text-xs text-red-500 mt-1">Amount exceeds current capital balance</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Date *</label>
                <input type="date" value={txnForm.transaction_date}
                  onChange={e => setTxnForm({ ...txnForm, transaction_date: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Notes</label>
                <textarea value={txnForm.notes} onChange={e => setTxnForm({ ...txnForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" rows="2" placeholder="Optional..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setTxnModal(null)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={submitting}
                  className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${txnModal.type === 'injection' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                  {submitting ? 'Saving...' : `Confirm ${txnModal.type === 'injection' ? 'Injection' : 'Drawing'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold dark:text-white">Transaction History — {historyModal.name}</h3>
              <button onClick={() => { setHistoryModal(null); setHistoryData(null) }} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="p-6">
              {!historyData ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-sm text-blue-600 dark:text-blue-400">Current Capital</p>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{fmt(historyData.shareholder.capital)}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <p className="text-sm text-green-600 dark:text-green-400">Total Injections</p>
                      <p className="text-lg font-bold text-green-700 dark:text-green-300">{fmt(historyData.total_injections)}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                      <p className="text-sm text-orange-600 dark:text-orange-400">Total Drawings</p>
                      <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{fmt(historyData.total_drawings)}</p>
                    </div>
                  </div>
                  {historyData.transactions.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No transactions recorded</p>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          {['Date', 'Type', 'Amount', 'Notes', 'By'].map(h => (
                            <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {historyData.transactions.map(txn => (
                          <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm dark:text-white">{fmtDate(txn.transaction_date)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${txn.transaction_type === 'injection' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'}`}>
                                {txn.transaction_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium dark:text-white">{fmt(txn.amount)}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{txn.notes || '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{txn.recorded_by_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3 dark:text-white">Delete Shareholder</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Delete <strong className="dark:text-white">{deleteModal.name}</strong> ({fmt(deleteModal.capital)})? All transaction history will also be deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} disabled={deleting}
                className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
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