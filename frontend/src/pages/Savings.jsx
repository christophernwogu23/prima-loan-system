import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import client from '../api/client'
import toast from 'react-hot-toast'
import { Wallet, DollarSign, Calendar, ArrowDownCircle, ArrowUpCircle, Trash2, X, RefreshCw } from 'lucide-react'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount || 0)

export default function Savings() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)

  // Customer state
  const [myBalance, setMyBalance] = useState(0)

  // Staff state
  const [savingsData, setSavingsData] = useState([])
  const [customers, setCustomers] = useState([])

  // Transaction modal
  const [txModal, setTxModal] = useState(null) // { type: 'deposit'|'withdraw', user_id?, name?, balance? }
  const [txAmount, setTxAmount] = useState('')
  const [txNote, setTxNote] = useState('')
  const [txLoading, setTxLoading] = useState(false)

  // Delete modal (admin only)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const isCustomer = user?.role === 'customer'
  const isAdmin = user?.role === 'admin'
  const isStaff = ['admin', 'manager', 'loan_officer'].includes(user?.role)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      if (isCustomer) {
        const { data } = await client.get('/savings/my-balance')
        setMyBalance(data.balance)
      } else {
        const [savRes, usersRes] = await Promise.all([
          client.get('/savings/'),
          client.get('/users/?role=customer')
        ])
        // Merge savings with customer names
        const savMap = {}
        savRes.data.forEach(s => { savMap[s.user_id] = s })
        const merged = usersRes.data.map(u => ({
          user_id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          balance: savMap[u.id]?.balance || 0,
          updated_at: savMap[u.id]?.updated_at || null,
        }))
        setSavingsData(merged)
        setCustomers(usersRes.data)
      }
    } catch (err) {
      toast.error('Failed to load savings data')
    } finally {
      setLoading(false)
    }
  }

  const openTxModal = (type, userId = null, name = '', balance = 0) => {
    setTxModal({ type, user_id: userId, name, balance })
    setTxAmount('')
    setTxNote('')
  }

  const handleTransaction = async (e) => {
    e.preventDefault()
    const amount = parseFloat(txAmount)
    if (!amount || amount <= 0) return toast.error('Enter a valid amount')
    if (txModal.type === 'withdraw' && amount > txModal.balance) return toast.error('Insufficient balance')

    setTxLoading(true)
    try {
      const payload = { amount, note: txNote || null }
      // Staff must pass user_id, customers don't
      if (isStaff && txModal.user_id) payload.user_id = txModal.user_id

      await client.post(`/savings/${txModal.type}`, payload)
      toast.success(`${txModal.type === 'deposit' ? 'Deposit' : 'Withdrawal'} successful!`)
      setTxModal(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Transaction failed')
    } finally {
      setTxLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await client.delete(`/savings/${deleteModal.user_id}`)
      toast.success('Savings account deleted')
      setDeleteModal(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const totalSavings = savingsData.reduce((s, r) => s + r.balance, 0)

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">{isCustomer ? 'My Savings Account' : 'Savings Accounts'}</h2>
            <p className="text-gray-600 dark:text-gray-400">{isCustomer ? 'Manage your savings' : 'Manage customer savings'}</p>
          </div>
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <RefreshCw size={18} /> Refresh
          </button>
        </div>

        {/* ===== CUSTOMER VIEW ===== */}
        {isCustomer && (
          <>
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl p-8 relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-6 h-6" />
                  <p className="text-white/90 font-medium">Current Balance</p>
                </div>
                <h1 className="text-5xl font-bold mb-6">{formatCurrency(myBalance)}</h1>
                <div className="flex items-center gap-6">
                  <div><p className="text-white/80 text-sm">Account Status</p><p className="font-semibold">Active</p></div>
                  <div><p className="text-white/80 text-sm">Account Type</p><p className="font-semibold">Current</p></div>
                </div>
              </div>
            </div>

            {/* Customer Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => openTxModal('deposit', null, 'My Account', myBalance)}
                className="flex items-center justify-center gap-3 p-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              >
                <ArrowDownCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                <div className="text-left">
                  <p className="font-bold text-green-700 dark:text-green-400">Deposit</p>
                  <p className="text-sm text-green-600 dark:text-green-500">Add money to savings</p>
                </div>
              </button>
              <button
                onClick={() => openTxModal('withdraw', null, 'My Account', myBalance)}
                className="flex items-center justify-center gap-3 p-6 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
              >
                <ArrowUpCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                <div className="text-left">
                  <p className="font-bold text-orange-700 dark:text-orange-400">Withdraw</p>
                  <p className="text-sm text-orange-600 dark:text-orange-500">Take money out</p>
                </div>
              </button>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-6 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Minimum Balance</p>
                    <p className="text-xl font-bold dark:text-white">{formatCurrency(0)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">No minimum required</p>
              </div>
              <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-6 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Account Type</p>
                    <p className="text-xl font-bold dark:text-white">Current</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Instant access anytime</p>
              </div>
            </div>
          </>
        )}

        {/* ===== STAFF VIEW ===== */}
        {!isCustomer && (
          <>
            {/* Summary Card */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg flex justify-between items-center">
              <div>
                <p className="text-white/80 text-sm mb-1">Total Savings (All Customers)</p>
                <p className="text-3xl font-bold">{formatCurrency(totalSavings)}</p>
                <p className="text-white/80 text-xs mt-1">{savingsData.length} customer accounts</p>
              </div>
              <div className="p-4 bg-white/20 rounded-lg"><Wallet size={36} /></div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Customer</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Last Updated</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {savingsData.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">No savings accounts found</td></tr>
                  ) : savingsData.map(row => (
                    <tr key={row.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 font-medium dark:text-white">{row.name}</td>
                      <td className="px-6 py-4 text-right font-bold dark:text-white">{formatCurrency(row.balance)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openTxModal('deposit', row.user_id, row.name, row.balance)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg"
                            title="Deposit"
                          >
                            <ArrowDownCircle size={15} /> Deposit
                          </button>
                          <button
                            onClick={() => openTxModal('withdraw', row.user_id, row.name, row.balance)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-lg"
                            title="Withdraw"
                          >
                            <ArrowUpCircle size={15} /> Withdraw
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteModal(row)}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                              title="Delete"
                            >
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
          </>
        )}
      </div>

      {/* Transaction Modal */}
      {txModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                {txModal.type === 'deposit'
                  ? <ArrowDownCircle className="w-6 h-6 text-green-600" />
                  : <ArrowUpCircle className="w-6 h-6 text-orange-600" />}
                <h3 className="text-lg font-semibold dark:text-white capitalize">
                  {txModal.type} {txModal.name ? `— ${txModal.name}` : ''}
                </h3>
              </div>
              <button onClick={() => setTxModal(null)} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
              <p className="text-xl font-bold dark:text-white">{formatCurrency(txModal.balance)}</p>
            </div>

            <form onSubmit={handleTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Amount (₦) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={txAmount}
                  onChange={e => setTxAmount(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                  required
                  autoFocus
                />
                {txModal.type === 'withdraw' && txAmount && parseFloat(txAmount) > txModal.balance && (
                  <p className="text-xs text-red-500 mt-1">Amount exceeds available balance</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Note (Optional)</label>
                <input
                  type="text"
                  value={txNote}
                  onChange={e => setTxNote(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="e.g. Monthly savings, Loan repayment..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setTxModal(null)} className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txLoading}
                  className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${txModal.type === 'deposit' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                >
                  {txLoading ? 'Processing...' : `Confirm ${txModal.type === 'deposit' ? 'Deposit' : 'Withdrawal'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal (Admin only) */}
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
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}