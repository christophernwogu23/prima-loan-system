import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import { getFixedDeposits, createFixedDeposit, updateFixedDeposit, deleteFixedDeposit, getFixedDepositsSummary } from '../api/fixedDeposits'
import client from '../api/client'
import { Plus, X, Trash2, Edit2, Landmark, Calendar, AlertTriangle, TrendingUp, ArrowDownCircle, ArrowUpCircle, History } from 'lucide-react'
import toast from 'react-hot-toast'

const today = () => new Date().toISOString().split('T')[0]
const fmt = (amt) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amt || 0)
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export default function FixedDeposits() {
  const { user } = useAuthStore()
  const [deposits, setDeposits] = useState([])
  const [summary, setSummary] = useState({ total_amount: 0, total_interest: 0, active_count: 0, maturing_soon: 0, total_liquidated: 0 })
  const [loading, setLoading] = useState(true)

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [editingDeposit, setEditingDeposit] = useState(null)
  const [txnModal, setTxnModal] = useState(null) // { deposit, type: 'deposit'|'liquidation' }
  const [historyModal, setHistoryModal] = useState(null)
  const [historyData, setHistoryData] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)

  const [txnForm, setTxnForm] = useState({ amount: '', transaction_date: today(), notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [formData, setFormData] = useState({
    depositor_name: '', amount: '', interest_amount: '',
    value_date: '', maturity_date: '', duration: '6 MONTHS', notes: ''
  })

  const canEdit = ['admin', 'manager'].includes(user?.role)
  const isAdmin = user?.role === 'admin'

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [dep, sum] = await Promise.all([getFixedDeposits(), getFixedDepositsSummary()])
      setDeposits(dep)
      setSummary(sum)
    } catch { toast.error('Failed to load fixed deposits') }
    finally { setLoading(false) }
  }

  const resetForm = () => {
    setFormData({ depositor_name: '', amount: '', interest_amount: '', value_date: '', maturity_date: '', duration: '6 MONTHS', notes: '' })
    setEditingDeposit(null)
  }

  const handleOpenModal = (deposit = null) => {
    if (deposit) {
      setEditingDeposit(deposit)
      setFormData({
        depositor_name: deposit.depositor_name,
        amount: deposit.amount.toString(),
        interest_amount: deposit.interest_amount.toString(),
        value_date: deposit.value_date.split('T')[0],
        maturity_date: deposit.maturity_date.split('T')[0],
        duration: deposit.duration || '6 MONTHS',
        notes: deposit.notes || ''
      })
    } else { resetForm() }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.depositor_name || !formData.amount || !formData.value_date || !formData.maturity_date)
      return toast.error('Please fill in required fields')
    try {
      const payload = {
        depositor_name: formData.depositor_name,
        amount: parseFloat(formData.amount),
        interest_amount: parseFloat(formData.interest_amount) || 0,
        value_date: new Date(formData.value_date).toISOString(),
        maturity_date: new Date(formData.maturity_date).toISOString(),
        duration: formData.duration,
        notes: formData.notes
      }
      if (editingDeposit) {
        await updateFixedDeposit(editingDeposit.id, payload)
        toast.success('Fixed deposit updated')
      } else {
        await createFixedDeposit(payload)
        toast.success('Fixed deposit added')
      }
      setShowModal(false)
      resetForm()
      loadData()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save') }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await deleteFixedDeposit(deleteModal.id)
      toast.success('Fixed deposit deleted')
      setDeleteModal(null)
      loadData()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete') }
    finally { setDeleting(false) }
  }

  const handleStatusChange = async (deposit, newStatus) => {
    try {
      await updateFixedDeposit(deposit.id, { status: newStatus })
      toast.success(`Status updated to ${newStatus}`)
      loadData()
    } catch { toast.error('Failed to update status') }
  }

  const openTxnModal = (deposit, type) => {
    setTxnModal({ deposit, type })
    setTxnForm({ amount: type === 'liquidation' ? (deposit.amount + deposit.interest_amount).toString() : '', transaction_date: today(), notes: '' })
  }

  const handleTxnSubmit = async (e) => {
    e.preventDefault()
    if (!txnForm.amount || parseFloat(txnForm.amount) <= 0) return toast.error('Enter a valid amount')
    setSubmitting(true)
    try {
      await client.post(`/fixed-deposits/${txnModal.deposit.id}/transactions`, {
        transaction_type: txnModal.type,
        amount: parseFloat(txnForm.amount),
        transaction_date: txnForm.transaction_date,
        notes: txnForm.notes || null
      })
      toast.success(`${txnModal.type === 'deposit' ? 'Deposit' : 'Liquidation'} recorded!`)
      setTxnModal(null)
      loadData()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to record transaction') }
    finally { setSubmitting(false) }
  }

  const openHistory = async (deposit) => {
    setHistoryModal(deposit)
    try {
      const res = await client.get(`/fixed-deposits/${deposit.id}/transactions`)
      setHistoryData(res.data)
    } catch { toast.error('Failed to load history') }
  }

  const getStatusColor = (status) => ({
    active: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    matured: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    withdrawn: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
  }[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300')

  const isMaturing = (d) => new Date(d) <= new Date(Date.now() + 30 * 86400000)

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></Layout>

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fixed Deposits</h1>
            <p className="text-gray-600 dark:text-gray-400">Track investor fixed deposits</p>
          </div>
          {canEdit && (
            <button onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add Deposit
            </button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Active', value: fmt(summary.total_amount), icon: Landmark, color: 'blue' },
            { label: 'Total Interest', value: fmt(summary.total_interest), icon: TrendingUp, color: 'green' },
            { label: 'Active Count', value: summary.active_count, icon: Calendar, color: 'purple' },
            { label: 'Maturing Soon', value: summary.maturing_soon, icon: AlertTriangle, color: 'orange' },
            { label: 'Total Liquidated', value: fmt(summary.total_liquidated), icon: ArrowUpCircle, color: 'red' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-4 rounded-lg shadow">
              <div className="flex items-center gap-3">
                <div className={`p-2 bg-${s.color}-100 dark:bg-${s.color}-900/30 rounded-lg`}>
                  <s.icon className={`w-5 h-5 text-${s.color}-600 dark:text-${s.color}-400`} />
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
                  <p className="text-lg font-bold dark:text-white">{s.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {['Depositor', 'Amount', 'Interest', 'Value Date', 'Maturity', 'Duration', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {deposits.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">No fixed deposits recorded yet</td></tr>
              ) : deposits.map(dep => (
                <tr key={dep.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isMaturing(dep.maturity_date) && dep.status === 'active' ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}>
                  <td className="px-4 py-3 text-sm font-medium dark:text-white">{dep.depositor_name}</td>
                  <td className="px-4 py-3 text-sm dark:text-gray-300">{fmt(dep.amount)}</td>
                  <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 font-medium">{fmt(dep.interest_amount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{fmtDate(dep.value_date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {fmtDate(dep.maturity_date)}
                    {isMaturing(dep.maturity_date) && dep.status === 'active' && <span className="ml-1">⚠️</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{dep.duration}</td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <select value={dep.status} onChange={e => handleStatusChange(dep, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-0 ${getStatusColor(dep.status)}`}>
                        <option value="active">Active</option>
                        <option value="matured">Matured</option>
                        <option value="withdrawn">Withdrawn</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(dep.status)}`}>{dep.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {/* Deposit button */}
                      {canEdit && dep.status === 'active' && (
                        <button onClick={() => openTxnModal(dep, 'deposit')}
                          className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded" title="Record Deposit">
                          <ArrowDownCircle size={16} />
                        </button>
                      )}
                      {/* Liquidate button */}
                      {canEdit && dep.status !== 'withdrawn' && (
                        <button onClick={() => openTxnModal(dep, 'liquidation')}
                          className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded" title="Record Liquidation">
                          <ArrowUpCircle size={16} />
                        </button>
                      )}
                      {/* History */}
                      <button onClick={() => openHistory(dep)}
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Transaction History">
                        <History size={16} />
                      </button>
                      {/* Edit / Delete */}
                      {canEdit && (
                        <button onClick={() => handleOpenModal(dep)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                          <Edit2 size={16} />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => setDeleteModal(dep)}
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">{editingDeposit ? 'Edit' : 'Add'} Fixed Deposit</h2>
              <button onClick={() => { setShowModal(false); resetForm() }} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Depositor Name *</label>
                <input type="text" value={formData.depositor_name} onChange={e => setFormData({ ...formData, depositor_name: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Amount (₦) *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" placeholder="0.00" required />
                </div>
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Interest (₦)</label>
                  <input type="number" step="0.01" value={formData.interest_amount} onChange={e => setFormData({ ...formData, interest_amount: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Value Date *</label>
                  <input type="date" value={formData.value_date} onChange={e => setFormData({ ...formData, value_date: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" required />
                </div>
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Maturity Date *</label>
                  <input type="date" value={formData.maturity_date} onChange={e => setFormData({ ...formData, maturity_date: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Duration</label>
                <select value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white">
                  <option value="3 MONTHS">3 Months</option>
                  <option value="6 MONTHS">6 Months</option>
                  <option value="12 MONTHS">12 Months</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" rows="2" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm() }}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingDeposit ? 'Update' : 'Add Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal (Deposit / Liquidation) */}
      {txnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                {txnModal.type === 'deposit'
                  ? <ArrowDownCircle className="w-6 h-6 text-green-600" />
                  : <ArrowUpCircle className="w-6 h-6 text-orange-600" />}
                <h3 className="text-lg font-semibold dark:text-white capitalize">
                  {txnModal.type === 'deposit' ? 'Record Deposit' : 'Record Liquidation'} — {txnModal.deposit.depositor_name}
                </h3>
              </div>
              <button onClick={() => setTxnModal(null)} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Principal:</span><span className="font-medium dark:text-white">{fmt(txnModal.deposit.amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Interest:</span><span className="font-medium dark:text-white">{fmt(txnModal.deposit.interest_amount)}</span></div>
              <div className="flex justify-between border-t dark:border-gray-600 pt-1"><span className="text-gray-500 dark:text-gray-400">Total Payable:</span><span className="font-bold dark:text-white">{fmt(txnModal.deposit.amount + txnModal.deposit.interest_amount)}</span></div>
            </div>

            {txnModal.type === 'liquidation' && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-orange-800 dark:text-orange-300">This will mark the fixed deposit as <strong>Withdrawn</strong> after recording.</p>
              </div>
            )}

            <form onSubmit={handleTxnSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  {txnModal.type === 'deposit' ? 'Deposit' : 'Liquidation'} Amount (₦) *
                </label>
                <input type="number" step="0.01" value={txnForm.amount}
                  onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" placeholder="0.00" required autoFocus />
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
                  className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${txnModal.type === 'deposit' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                  {submitting ? 'Saving...' : `Confirm ${txnModal.type === 'deposit' ? 'Deposit' : 'Liquidation'}`}
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
              <h3 className="text-lg font-semibold dark:text-white">Transaction History — {historyModal.depositor_name}</h3>
              <button onClick={() => { setHistoryModal(null); setHistoryData(null) }} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="p-6">
              {!historyData ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <p className="text-sm text-green-600 dark:text-green-400">Total Deposited</p>
                      <p className="text-xl font-bold text-green-700 dark:text-green-300">{fmt(historyData.total_deposited)}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                      <p className="text-sm text-orange-600 dark:text-orange-400">Total Liquidated</p>
                      <p className="text-xl font-bold text-orange-700 dark:text-orange-300">{fmt(historyData.total_liquidated)}</p>
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
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${txn.transaction_type === 'deposit' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'}`}>
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
            <h3 className="text-lg font-semibold mb-3 dark:text-white">Delete Fixed Deposit</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Delete fixed deposit for <strong className="dark:text-white">{deleteModal.depositor_name}</strong> ({fmt(deleteModal.amount)})? All transaction history will also be deleted.
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