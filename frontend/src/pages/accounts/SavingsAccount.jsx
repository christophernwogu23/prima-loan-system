import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuthStore } from '../../store/authStore'
import { ArrowLeft, Users, TrendingUp, ArrowDownCircle, ArrowUpCircle, Trash2, X, Search } from 'lucide-react'
import client from '../../api/client'
import toast from 'react-hot-toast'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount || 0)

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function SavingsAccount() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [savings, setSavings] = useState([])
  const [customers, setCustomers] = useState([])
  const [stats, setStats] = useState({ total_balance: 0, accounts_count: 0 })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Transaction modal
  const [txModal, setTxModal] = useState(null) // { type, user_id, name, balance }
  const [txAmount, setTxAmount] = useState('')
  const [txNote, setTxNote] = useState('')
  const [txDate, setTxDate] = useState(todayStr())
  const [txLoading, setTxLoading] = useState(false)

  // Delete modal
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [savRes, usersRes] = await Promise.all([
        client.get('/savings/'),
        client.get('/users/?role=customer')
      ])

      // Build a map of user_id -> customer name
      const nameMap = {}
      usersRes.data.forEach(u => { nameMap[u.id] = `${u.first_name} ${u.last_name}` })
      setCustomers(usersRes.data)

      const enriched = savRes.data.map(s => ({ ...s, name: nameMap[s.user_id] || `Customer #${s.user_id}` }))
      setSavings(enriched)

      const totalBalance = enriched.reduce((sum, s) => sum + s.balance, 0)
      setStats({ total_balance: totalBalance, accounts_count: enriched.length })
    } catch (error) {
      console.error('Failed to load savings:', error)
      toast.error('Failed to load savings data')
    } finally {
      setLoading(false)
    }
  }

  const openTxModal = (type, saving) => {
    setTxModal({ type, user_id: saving.user_id, name: saving.name, balance: saving.balance })
    setTxAmount('')
    setTxNote('')
    setTxDate(todayStr())
  }

  const handleTransaction = async (e) => {
    e.preventDefault()
    const amount = parseFloat(txAmount)
    if (!amount || amount <= 0) return toast.error('Enter a valid amount')
    if (txModal.type === 'withdraw' && amount > txModal.balance) return toast.error('Insufficient balance')
    if (!txDate) return toast.error('Select a posting date')

    setTxLoading(true)
    try {
      await client.post(`/savings/${txModal.type}`, {
        user_id: txModal.user_id,
        amount,
        note: txNote || null,
        transaction_date: new Date(`${txDate}T00:00:00`).toISOString()
      })
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

  const filteredSavings = savings.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/accounts')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft size={20} className="dark:text-white" />
          </button>
          <div>
            <h2 className="text-2xl font-bold dark:text-white">Savings Accounts</h2>
            <p className="text-gray-600 dark:text-gray-400">Customer savings and deposits</p>
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
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">{formatCurrency(stats.total_balance)}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Active Accounts</p>
                </div>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.accounts_count}</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                <h3 className="text-lg font-semibold dark:text-white">Savings Accounts</h3>
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
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
                      <th className="text-left py-3 text-sm font-semibold dark:text-white">Last Updated</th>
                      <th className="text-right py-3 text-sm font-semibold dark:text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredSavings.length === 0 ? (
                      <tr><td colSpan={4} className="py-10 text-center text-gray-500 dark:text-gray-400">
                        {searchTerm ? 'No customers match your search' : 'No savings accounts found'}
                      </td></tr>
                    ) : filteredSavings.map(saving => (
                      <tr key={saving.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-3 text-sm dark:text-white">{saving.name}</td>
                        <td className="py-3 text-sm font-medium text-right text-green-600 dark:text-green-400">
                          {formatCurrency(saving.balance)}
                        </td>
                        <td className="py-3 text-sm text-gray-500 dark:text-gray-400">
                          {saving.updated_at ? new Date(saving.updated_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openTxModal('deposit', saving)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg"
                            >
                              <ArrowDownCircle size={14} /> Deposit
                            </button>
                            <button
                              onClick={() => openTxModal('withdraw', saving)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-lg"
                            >
                              <ArrowUpCircle size={14} /> Withdraw
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => setDeleteModal(saving)}
                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                title="Delete"
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
                  {txModal.type} — {txModal.name}
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
                  type="number" step="0.01" value={txAmount}
                  onChange={e => setTxAmount(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="0.00" required autoFocus
                />
                {txModal.type === 'withdraw' && txAmount && parseFloat(txAmount) > txModal.balance && (
                  <p className="text-xs text-red-500 mt-1">Amount exceeds available balance</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Posting Date *</label>
                <input
                  type="date" value={txDate} max={todayStr()}
                  onChange={e => setTxDate(e.target.value)}
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
                  type="text" value={txNote} onChange={e => setTxNote(e.target.value)}
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
                  {txLoading ? 'Processing...' : `Confirm ${txModal.type === 'deposit' ? 'Deposit' : 'Withdrawal'}`}
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