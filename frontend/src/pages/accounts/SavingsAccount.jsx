import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuthStore } from '../../store/authStore'
import {
  ArrowLeft, Users, TrendingUp, ArrowDownCircle, ArrowUpCircle,
  ArrowLeftRight, Trash2, X, Search, RefreshCw
} from 'lucide-react'
import client from '../../api/client'
import toast from 'react-hot-toast'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount || 0)

// Today's date in the user's own timezone, as YYYY-MM-DD
const todayStr = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Send the chosen date as plain local date-time (noon, no timezone), so the date the
// user picked is the date that is stored and shown, whatever timezone the server is in.
const toPostingDate = (dateStr) => `${dateStr}T12:00:00`

// Turns a backend error into a readable message
const errorMessage = (err, fallback) => {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) return detail.map((d) => d.msg).join(', ')
  return fallback
}

/* ────────────────────────────────────────────────────────────
   Searchable customer picker (used in the transfer form)
──────────────────────────────────────────────────────────── */
function CustomerSelect({ customers, value, onChange, excludeId, placeholder = 'Search customer by name...' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  const selected = customers.find((c) => c.user_id === value)

  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return customers
      .filter((c) => c.user_id !== excludeId)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [customers, query, excludeId])

  if (selected) {
    return (
      <div className="flex items-center justify-between px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700">
        <div>
          <p className="text-sm font-medium dark:text-white">{selected.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {selected.has_savings_account
              ? `Balance: ${formatCurrency(selected.balance)}`
              : 'No savings account yet'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { onChange(null); setQuery('') }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
      />
      {open && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">No customers found</li>
          ) : matches.map((c) => (
            <li key={c.user_id}>
              <button
                type="button"
                onClick={() => { onChange(c.user_id); setOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                <span className="dark:text-white">{c.name}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {c.has_savings_account ? formatCurrency(c.balance) : 'No savings account yet'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────── */
export default function SavingsAccount() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Deposit / withdrawal modal
  const [txModal, setTxModal] = useState(null) // { type: 'deposit' | 'withdraw', userId }
  const [txAmount, setTxAmount] = useState('')
  const [txNote, setTxNote] = useState('')
  const [txDate, setTxDate] = useState(todayStr())
  const [txLoading, setTxLoading] = useState(false)

  // Transfer modal
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferFrom, setTransferFrom] = useState(null)
  const [transferTo, setTransferTo] = useState(null)
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [transferDate, setTransferDate] = useState(todayStr())
  const [transferLoading, setTransferLoading] = useState(false)

  // Delete modal
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Every active customer, with balance 0 and has_savings_account=false if no account yet
      const { data } = await client.get('/savings/customers')
      setCustomers(data)
    } catch (error) {
      console.error('Failed to load savings:', error)
      toast.error(errorMessage(error, 'Failed to load savings data'))
    } finally {
      setLoading(false)
    }
  }

  const customerById = (id) => customers.find((c) => c.user_id === id)

  /* ── Deposit / withdrawal ── */
  const openTxModal = (type, customer) => {
    setTxModal({ type, userId: customer.user_id })
    setTxAmount('')
    setTxNote('')
    setTxDate(todayStr())
  }

  const txCustomer = txModal ? customerById(txModal.userId) : null

  const handleTransaction = async (e) => {
    e.preventDefault()
    const amount = parseFloat(txAmount)
    if (!amount || amount <= 0) return toast.error('Enter an amount greater than zero')
    if (txModal.type === 'withdraw' && amount > (txCustomer?.balance || 0)) {
      return toast.error('Amount is more than the available balance')
    }
    if (!txDate) return toast.error('Select a posting date')

    setTxLoading(true)
    try {
      await client.post(`/savings/${txModal.type}`, {
        user_id: txModal.userId,
        amount,
        note: txNote.trim() || null,
        transaction_date: toPostingDate(txDate),
      })
      toast.success(txModal.type === 'deposit' ? 'Deposit posted' : 'Withdrawal posted')
      setTxModal(null)
      loadData()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not post the transaction'))
    } finally {
      setTxLoading(false)
    }
  }

  /* ── Transfer ── */
  const openTransferModal = (fromCustomer = null) => {
    setTransferFrom(fromCustomer ? fromCustomer.user_id : null)
    setTransferTo(null)
    setTransferAmount('')
    setTransferNote('')
    setTransferDate(todayStr())
    setTransferOpen(true)
  }

  const handleTransfer = async (e) => {
    e.preventDefault()
    if (!transferFrom) return toast.error('Select the customer to transfer from')
    if (!transferTo) return toast.error('Select the customer to transfer to')
    if (transferFrom === transferTo) return toast.error('Choose two different customers')
    const amount = parseFloat(transferAmount)
    if (!amount || amount <= 0) return toast.error('Enter an amount greater than zero')
    const source = customerById(transferFrom)
    if (amount > (source?.balance || 0)) return toast.error('Amount is more than the sender\u2019s balance')
    if (!transferDate) return toast.error('Select a posting date')

    setTransferLoading(true)
    try {
      await client.post('/savings/transfer', {
        from_user_id: transferFrom,
        to_user_id: transferTo,
        amount,
        note: transferNote.trim() || null,
        transaction_date: toPostingDate(transferDate),
      })
      toast.success('Transfer posted')
      setTransferOpen(false)
      loadData()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not post the transfer'))
    } finally {
      setTransferLoading(false)
    }
  }

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await client.delete(`/savings/${deleteModal.user_id}`)
      toast.success('Savings account deleted')
      setDeleteModal(null)
      loadData()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete the savings account'))
    } finally {
      setDeleting(false)
    }
  }

  /* ── Derived values ── */
  const totalBalance = customers.reduce((sum, c) => sum + (c.balance || 0), 0)
  const accountsCount = customers.filter((c) => c.has_savings_account).length
  const withoutAccount = customers.length - accountsCount

  const filteredCustomers = customers.filter((c) => {
    const q = searchTerm.trim().toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
  })

  const transferSource = transferFrom ? customerById(transferFrom) : null
  const transferDest = transferTo ? customerById(transferTo) : null

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/accounts')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <ArrowLeft size={20} className="dark:text-white" />
            </button>
            <div>
              <h2 className="text-2xl font-bold dark:text-white">Savings Accounts</h2>
              <p className="text-gray-600 dark:text-gray-400">Customer savings, deposits and transfers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openTransferModal()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              <ArrowLeftRight size={16} /> Transfer
            </button>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Savings Balance</p>
                </div>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">{formatCurrency(totalBalance)}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Active Accounts</p>
                </div>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{accountsCount}</p>
                {withoutAccount > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {withoutAccount} {withoutAccount === 1 ? 'customer has' : 'customers have'} no savings account yet
                  </p>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                <h3 className="text-lg font-semibold dark:text-white">All Customers</h3>
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search customer by name..."
                    className="w-full pl-9 pr-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b dark:border-gray-700">
                    <tr>
                      <th className="text-left py-3 text-sm font-semibold dark:text-white">Customer</th>
                      <th className="text-right py-3 text-sm font-semibold dark:text-white">Balance</th>
                      <th className="text-left py-3 pl-6 text-sm font-semibold dark:text-white">Last Updated</th>
                      <th className="text-right py-3 text-sm font-semibold dark:text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-gray-500 dark:text-gray-400">
                          {searchTerm ? 'No customers match your search' : 'No customers found'}
                        </td>
                      </tr>
                    ) : filteredCustomers.map((c) => (
                      <tr key={c.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-3 text-sm dark:text-white">
                          {c.name}
                          {!c.has_savings_account && (
                            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                              No account yet
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-sm font-medium text-right text-green-600 dark:text-green-400">
                          {formatCurrency(c.balance)}
                        </td>
                        <td className="py-3 pl-6 text-sm text-gray-500 dark:text-gray-400">
                          {c.updated_at ? new Date(c.updated_at).toLocaleDateString() : '\u2014'}
                        </td>
                        <td className="py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openTxModal('deposit', c)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg"
                            >
                              <ArrowDownCircle size={14} /> Deposit
                            </button>
                            <button
                              onClick={() => openTxModal('withdraw', c)}
                              disabled={!(c.balance > 0)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <ArrowUpCircle size={14} /> Withdraw
                            </button>
                            <button
                              onClick={() => openTransferModal(c)}
                              disabled={!(c.balance > 0)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Transfer to another customer"
                            >
                              <ArrowLeftRight size={14} /> Transfer
                            </button>
                            {isAdmin && c.has_savings_account && (
                              <button
                                onClick={() => setDeleteModal(c)}
                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                title="Delete savings account"
                              >
                                <Trash2 size={15} />
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
          </>
        )}
      </div>

      {/* Deposit / withdrawal modal */}
      {txModal && txCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                {txModal.type === 'deposit'
                  ? <ArrowDownCircle className="w-6 h-6 text-green-600" />
                  : <ArrowUpCircle className="w-6 h-6 text-orange-600" />}
                <h3 className="text-lg font-semibold dark:text-white capitalize">
                  {txModal.type} — {txCustomer.name}
                </h3>
              </div>
              <button onClick={() => setTxModal(null)} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
              <p className="text-xl font-bold dark:text-white">{formatCurrency(txCustomer.balance)}</p>
              {!txCustomer.has_savings_account && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This customer has no savings account yet. The first deposit creates one.
                </p>
              )}
            </div>

            <form onSubmit={handleTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Amount (₦) *</label>
                <input
                  type="number" step="0.01" min="0" value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="0.00" required autoFocus
                />
                {txModal.type === 'withdraw' && txAmount && parseFloat(txAmount) > txCustomer.balance && (
                  <p className="text-xs text-red-500 mt-1">Amount is more than the available balance</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Posting Date *</label>
                <input
                  type="date" value={txDate} max={todayStr()}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                />
                {txDate && txDate !== todayStr() && (
                  <p className="text-xs text-amber-500 mt-1">This will be posted as a back-dated transaction</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Note (Optional)</label>
                <input
                  type="text" value={txNote} onChange={(e) => setTxNote(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="e.g. Monthly savings..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setTxModal(null)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button type="submit" disabled={txLoading}
                  className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${txModal.type === 'deposit' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                  {txLoading ? 'Posting...' : txModal.type === 'deposit' ? 'Post deposit' : 'Post withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {transferOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <ArrowLeftRight className="w-6 h-6 text-purple-600" />
                <h3 className="text-lg font-semibold dark:text-white">Transfer between customers</h3>
              </div>
              <button onClick={() => setTransferOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">From customer *</label>
                <CustomerSelect
                  customers={customers.filter((c) => c.balance > 0)}
                  value={transferFrom}
                  onChange={setTransferFrom}
                  excludeId={transferTo}
                  placeholder="Search customer to take money from..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">To customer *</label>
                <CustomerSelect
                  customers={customers}
                  value={transferTo}
                  onChange={setTransferTo}
                  excludeId={transferFrom}
                  placeholder="Search customer to send money to..."
                />
                {transferDest && !transferDest.has_savings_account && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    A savings account will be created for {transferDest.name}.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Amount (₦) *</label>
                <input
                  type="number" step="0.01" min="0" value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="0.00" required
                />
                {transferSource && transferAmount && parseFloat(transferAmount) > transferSource.balance && (
                  <p className="text-xs text-red-500 mt-1">
                    Amount is more than {transferSource.name}'s balance ({formatCurrency(transferSource.balance)})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Posting Date *</label>
                <input
                  type="date" value={transferDate} max={todayStr()}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                />
                {transferDate && transferDate !== todayStr() && (
                  <p className="text-xs text-amber-500 mt-1">This will be posted as a back-dated transfer</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Note (Optional)</label>
                <input
                  type="text" value={transferNote} onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="e.g. Reallocation of savings..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setTransferOpen(false)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button type="submit" disabled={transferLoading}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  {transferLoading ? 'Posting...' : 'Post transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3 dark:text-white">Delete Savings Account</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete <strong className="dark:text-white">{deleteModal.name}</strong>'s savings account?
              Current balance is <strong>{formatCurrency(deleteModal.balance)}</strong>. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} disabled={deleting}
                className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}