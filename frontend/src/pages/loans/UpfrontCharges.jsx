import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import client from '../api/client'
import toast from 'react-hot-toast'
import { Plus, X, Trash2, Search, Calendar, RefreshCw } from 'lucide-react'

const BVN_AMOUNT = 1000
const LOAN_FORM_AMOUNT = 1000
const CREDIT_SEARCH_AMOUNT = 1000

const today = () => new Date().toISOString().split('T')[0]

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount || 0)

export default function UpfrontCharges() {
  const { user } = useAuthStore()
  const [charges, setCharges] = useState([])
  const [summary, setSummary] = useState(null)
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [loanSearch, setLoanSearch] = useState('')
  const [showLoanDropdown, setShowLoanDropdown] = useState(false)

  const [form, setForm] = useState({
    loan_application_id: '',
    is_first_timer: false,
    bvn_charge: 0,
    loan_form_charge: 0,
    credit_search_charge: 0,
    other_charge: 0,
    other_charge_label: '',
    charge_date: today(),
    notes: ''
  })

  const canCreate = ['admin', 'manager', 'loan_officer'].includes(user?.role)
  const isAdmin = user?.role === 'admin'
  const canViewSummary = ['admin', 'manager', 'ceo'].includes(user?.role)

  const generateMonthOptions = () => {
    const months = [{ value: '', label: 'All Time' }]
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ value: date.toISOString().slice(0, 7), label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) })
    }
    return months
  }

  useEffect(() => { loadData() }, [selectedMonth])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = selectedMonth ? `?month=${selectedMonth}` : ''
      const [chargesRes, loansRes] = await Promise.all([
        client.get(`/upfront/${params}`),
        client.get('/payments/disbursed-loans')
      ])
      setCharges(chargesRes.data)

      if (canViewSummary) {
        const summaryRes = await client.get('/upfront/summary')
        setSummary(summaryRes.data)
      }

      setLoans(loansRes.data)
    } catch (err) {
      toast.error('Failed to load upfront charges')
    } finally {
      setLoading(false)
    }
  }

  const selectedLoan = loans.find(l => l.id === parseInt(form.loan_application_id))
  const filteredLoans = loans.filter(l => {
    if (!loanSearch) return true
    const s = loanSearch.toLowerCase()
    return l.customer_name?.toLowerCase().includes(s) || l.product_name?.toLowerCase().includes(s)
  })

  const total = (form.is_first_timer ? form.bvn_charge : 0) +
    form.loan_form_charge + form.credit_search_charge + form.other_charge

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.loan_application_id) return toast.error('Please select a loan')
    setSubmitting(true)
    try {
      await client.post('/upfront/', {
        ...form,
        loan_application_id: parseInt(form.loan_application_id),
        bvn_charge: form.is_first_timer ? parseFloat(form.bvn_charge) : 0,
        loan_form_charge: parseFloat(form.loan_form_charge),
        credit_search_charge: parseFloat(form.credit_search_charge),
        other_charge: parseFloat(form.other_charge),
      })
      toast.success('Upfront charges recorded!')
      setShowModal(false)
      resetForm()
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record charges')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await client.delete(`/upfront/${deleteModal.id}`)
      toast.success('Charge deleted')
      setDeleteModal(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const resetForm = () => {
    setForm({ loan_application_id: '', is_first_timer: false, bvn_charge: 0, loan_form_charge: 0, credit_search_charge: 0, other_charge: 0, other_charge_label: '', charge_date: today(), notes: '' })
    setLoanSearch('')
    setShowLoanDropdown(false)
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">Upfront Charges</h2>
            <p className="text-gray-600 dark:text-gray-400">BVN, Loan Form & Credit Search fees</p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
              <RefreshCw size={18} />
            </button>
            {canCreate && (
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus size={18} /> Record Charges
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {canViewSummary && summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Collected', value: formatCurrency(summary.total_collected), color: 'blue' },
              { label: 'BVN Charges', value: formatCurrency(summary.total_bvn), color: 'purple' },
              { label: 'Loan Form', value: formatCurrency(summary.total_loan_form), color: 'green' },
              { label: 'Credit Search', value: formatCurrency(summary.total_credit_search), color: 'orange' },
              { label: 'Other', value: formatCurrency(summary.total_other), color: 'gray' },
            ].map(s => (
              <div key={s.label} className={`bg-${s.color}-50 dark:bg-${s.color}-900/20 border border-${s.color}-200 dark:border-${s.color}-800 p-4 rounded-lg`}>
                <p className={`text-sm text-${s.color}-600 dark:text-${s.color}-400 font-medium`}>{s.label}</p>
                <p className={`text-xl font-bold text-${s.color}-700 dark:text-${s.color}-300 mt-1`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-4">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
            {generateMonthOptions().map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {['Date', 'Customer', 'App #', 'BVN', 'Loan Form', 'Credit Search', 'Other', 'Total', 'Notes', ...(isAdmin ? [''] : [])].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={isAdmin ? 10 : 9} className="px-4 py-10 text-center text-gray-500">Loading...</td></tr>
              ) : charges.length === 0 ? (
                <tr><td colSpan={isAdmin ? 10 : 9} className="px-4 py-10 text-center text-gray-500">No upfront charges recorded</td></tr>
              ) : charges.map(charge => (
                <tr key={charge.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm dark:text-white">{new Date(charge.charge_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm font-medium dark:text-white">{charge.customer_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">{charge.application_number}</td>
                  <td className="px-4 py-3 text-sm dark:text-white">
                    {charge.bvn_charge > 0 ? (
                      <span className="flex items-center gap-1">
                        {formatCurrency(charge.bvn_charge)}
                        {charge.is_first_timer && <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full">1st timer</span>}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm dark:text-white">{charge.loan_form_charge > 0 ? formatCurrency(charge.loan_form_charge) : <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-sm dark:text-white">{charge.credit_search_charge > 0 ? formatCurrency(charge.credit_search_charge) : <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-sm dark:text-white">
                    {charge.other_charge > 0 ? (
                      <span title={charge.other_charge_label || ''}>{formatCurrency(charge.other_charge)}</span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-blue-600 dark:text-blue-400">{formatCurrency(charge.total_charge)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{charge.notes || '—'}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <button onClick={() => setDeleteModal(charge)}
                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Charges Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Record Upfront Charges</h3>
              <button onClick={() => { setShowModal(false); resetForm() }} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Loan selector */}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Loan / Customer *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input type="text" placeholder="Search customer or product..."
                    value={selectedLoan ? `${selectedLoan.customer_name} — ${selectedLoan.product_name}` : loanSearch}
                    onChange={e => { setLoanSearch(e.target.value); setForm({ ...form, loan_application_id: '' }); setShowLoanDropdown(true) }}
                    onFocus={() => setShowLoanDropdown(true)}
                    className="w-full pl-9 pr-8 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
                  {form.loan_application_id && (
                    <button type="button" onClick={() => { setForm({ ...form, loan_application_id: '' }); setLoanSearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                  )}
                  {showLoanDropdown && !form.loan_application_id && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredLoans.length === 0
                        ? <p className="px-4 py-3 text-sm text-gray-500">No loans found</p>
                        : filteredLoans.map(l => (
                          <button key={l.id} type="button"
                            onClick={() => { setForm({ ...form, loan_application_id: String(l.id) }); setLoanSearch(''); setShowLoanDropdown(false) }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white">
                            {l.customer_name} — {l.product_name} ({formatCurrency(l.amount)})
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Charge Date */}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300 flex items-center gap-2">
                  <Calendar size={14} /> Charge Date *
                </label>
                <input type="date" value={form.charge_date}
                  onChange={e => setForm({ ...form, charge_date: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" required />
                <p className="text-xs text-gray-500 mt-1">Can differ from disbursement date</p>
              </div>

              {/* Charge items */}
              <div className="border dark:border-gray-600 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium dark:text-gray-300 mb-2">Select Applicable Charges</p>

                {/* BVN — first-timers only */}
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="bvn"
                      checked={form.is_first_timer}
                      onChange={e => setForm({ ...form, is_first_timer: e.target.checked, bvn_charge: e.target.checked ? BVN_AMOUNT : 0 })}
                      className="w-4 h-4 rounded" />
                    <div>
                      <label htmlFor="bvn" className="text-sm font-medium dark:text-white cursor-pointer">BVN Charge</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">First-time customers only</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${form.is_first_timer ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`}>
                    {formatCurrency(BVN_AMOUNT)}
                  </span>
                </div>

                {/* Loan Form */}
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="form"
                      checked={form.loan_form_charge > 0}
                      onChange={e => setForm({ ...form, loan_form_charge: e.target.checked ? LOAN_FORM_AMOUNT : 0 })}
                      className="w-4 h-4 rounded" />
                    <label htmlFor="form" className="text-sm font-medium dark:text-white cursor-pointer">Loan Form</label>
                  </div>
                  <span className={`text-sm font-bold ${form.loan_form_charge > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                    {formatCurrency(LOAN_FORM_AMOUNT)}
                  </span>
                </div>

                {/* Credit Search */}
                <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="credit"
                      checked={form.credit_search_charge > 0}
                      onChange={e => setForm({ ...form, credit_search_charge: e.target.checked ? CREDIT_SEARCH_AMOUNT : 0 })}
                      className="w-4 h-4 rounded" />
                    <label htmlFor="credit" className="text-sm font-medium dark:text-white cursor-pointer">Credit Search</label>
                  </div>
                  <span className={`text-sm font-bold ${form.credit_search_charge > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>
                    {formatCurrency(CREDIT_SEARCH_AMOUNT)}
                  </span>
                </div>

                {/* Other charge */}
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="other"
                      checked={form.other_charge > 0}
                      onChange={e => setForm({ ...form, other_charge: e.target.checked ? 0 : 0 })}
                      className="w-4 h-4 rounded" />
                    <label htmlFor="other" className="text-sm font-medium dark:text-white cursor-pointer">Other Charge</label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input type="text" placeholder="Label (e.g. Insurance)"
                      value={form.other_charge_label}
                      onChange={e => setForm({ ...form, other_charge_label: e.target.value })}
                      className="px-3 py-1.5 border dark:border-gray-600 rounded dark:bg-gray-600 dark:text-white text-sm" />
                    <input type="number" placeholder="Amount"
                      value={form.other_charge || ''}
                      onChange={e => setForm({ ...form, other_charge: parseFloat(e.target.value) || 0 })}
                      className="px-3 py-1.5 border dark:border-gray-600 rounded dark:bg-gray-600 dark:text-white text-sm" />
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
                <span className="font-medium dark:text-white">Total Upfront Charges</span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(total)}</span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Notes (Optional)</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" rows="2" placeholder="Any additional notes..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm() }}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={submitting || total === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Record Charges'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3 dark:text-white">Delete Upfront Charge</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Delete charge of <strong className="dark:text-white">{formatCurrency(deleteModal.total_charge)}</strong> for <strong className="dark:text-white">{deleteModal.customer_name}</strong>? This cannot be undone.
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