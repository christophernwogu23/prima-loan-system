import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import client from '../api/client'
import toast from 'react-hot-toast'
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, Trash2, X,
  RefreshCw, History, TrendingUp, TrendingDown, User, Search, ArrowLeftRight
} from 'lucide-react'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount || 0)

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// Today's date as YYYY-MM-DD, for defaulting the date input
const todayStr = () => new Date().toISOString().slice(0, 10)

export default function Savings() {
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('accounts') // 'accounts' | 'history'

  // Customer state
  const [myBalance, setMyBalance] = useState(0)
  const [myTransactions, setMyTransactions] = useState([])

  // Staff state
  const [savingsData, setSavingsData] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedHistory, setSelectedHistory] = useState(null) // { user_id, name, txns[] }
  const [historyLoading, setHistoryLoading] = useState(false)

  // Transaction modal
  const [txModal, setTxModal] = useState(null)
  const [txAmount, setTxAmount] = useState('')
  const [txNote, setTxNote] = useState('')
  const [txDate, setTxDate] = useState(todayStr())
  const [txLoading, setTxLoading] = useState(false)

  // Transfer modal
  const [transferModal, setTransferModal] = useState(false)
  const [transferFrom, setTransferFrom] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [transferDate, setTransferDate] = useState(todayStr())
  const [transferLoading, setTransferLoading] = useState(false)

  // Delete modal
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const isCustomer = user?.role === 'customer'
  const isAdmin = user?.role === 'admin'

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      if (isCustomer) {
        const [balRes, txRes] = await Promise.all([
          client.get('/savings/my-balance'),
          client.get('/savings/transactions/my')
        ])
        setMyBalance(balRes.data.balance)
        setMyTransactions(txRes.data)
      } else {
        const [savRes, usersRes] = await Promise.all([
          client.get('/savings/'),
          client.get('/users/?role=customer')
        ])
        const savMap = {}
        savRes.data.forEach(s => { savMap[s.user_id] = s })
        const merged = usersRes.data.map(u => ({
          user_id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          balance: savMap[u.id]?.balance || 0,
          updated_at: savMap[u.id]?.updated_at || null,
        }))
        setSavingsData(merged)
      }
    } catch {
      toast.error('Failed to load savings data')
    } finally {
      setLoading(false)
    }
  }

  const loadCustomerHistory = async (userId, name) => {
    setHistoryLoading(true)
    setSelectedHistory({ user_id: userId, name, txns: [] })
    try {
      const { data } = await client.get(`/savings/transactions/${userId}`)
      setSelectedHistory({ user_id: userId, name, txns: data })
    } catch {
      toast.error('Failed to load transaction history')
    } finally {
      setHistoryLoading(false)
    }
  }

  const openTxModal = (type, userId = null, name = '', balance = 0) => {
    setTxModal({ type, user_id: userId, name, balance })
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
      const payload = {
        amount,
        note: txNote || null,
        transaction_date: new Date(`${txDate}T00:00:00`).toISOString()
      }
      if (!isCustomer && txModal.user_id) payload.user_id = txModal.user_id

      await client.post(`/savings/${txModal.type}`, payload)
      toast.success(`${txModal.type === 'deposit' ? 'Deposit' : 'Withdrawal'} successful!`)
      setTxModal(null)
      loadData()
      // Refresh history if viewing this customer's history
      if (selectedHistory && selectedHistory.user_id === txModal.user_id) {
        loadCustomerHistory(txModal.user_id, selectedHistory.name)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Transaction failed')
    } finally {
      setTxLoading(false)
    }
  }

  const openTransferModal = () => {
    setTransferFrom('')
    setTransferTo('')
    setTransferAmount('')
    setTransferNote('')
    setTransferDate(todayStr())
    setTransferModal(true)
  }

  const handleTransfer = async (e) => {
    e.preventDefault()
    if (!transferFrom || !transferTo) return toast.error('Select both customers')
    if (transferFrom === transferTo) return toast.error('Cannot transfer to the same customer')
    const amount = parseFloat(transferAmount)
    if (!amount || amount <= 0) return toast.error('Enter a valid amount')
    const source = savingsData.find(s => String(s.user_id) === String(transferFrom))
    if (source && amount > source.balance) return toast.error('Insufficient balance in source account')
    if (!transferDate) return toast.error('Select a posting date')

    setTransferLoading(true)
    try {
      await client.post('/savings/transfer', {
        from_user_id: Number(transferFrom),
        to_user_id: Number(transferTo),
        amount,
        note: transferNote || null,
        transaction_date: new Date(`${transferDate}T00:00:00`).toISOString()
      })
      toast.success('Transfer successful!')
      setTransferModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Transfer failed')
    } finally {
      setTransferLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await client.delete(`/savings/${deleteModal.user_id}`)
      toast.success('Savings account deleted')
      setDeleteModal(null)
      setSelectedHistory(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const totalSavings = savingsData.reduce((s, r) => s + r.balance, 0)

  const filteredSavingsData = savingsData.filter(row =>
    row.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">
              {isCustomer ? 'My Savings Account' : 'Savings Accounts'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isCustomer ? 'Manage your savings and view transaction history' : 'Manage customer savings'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isCustomer && (
              <button onClick={openTransferModal}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                <ArrowLeftRight size={16} /> Transfer
              </button>
            )}
            <button onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════
            CUSTOMER VIEW
        ══════════════════════════════════════ */}
        {isCustomer && (
          <>
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl p-8 relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24 pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet size={22} />
                  <p className="text-white/90 font-medium text-sm">Current Balance</p>
                </div>
                <h1 className="text-5xl font-bold mb-6">{formatCurrency(myBalance)}</h1>
                <div className="flex items-center gap-6 text-sm">
                  <div><p className="text-white/70">Status</p><p className="font-semibold">Active</p></div>
                  <div><p className="text-white/70">Type</p><p className="font-semibold">Savings</p></div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => openTxModal('deposit', null, 'My Account', myBalance)}
                className="flex items-center justify-center gap-3 p-5 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                <ArrowDownCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                <div className="text-left">
                  <p className="font-bold text-green-700 dark:text-green-400">Deposit</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Add money</p>
                </div>
              </button>
              <button
                onClick={() => openTxModal('withdraw', null, 'My Account', myBalance)}
                className="flex items-center justify-center gap-3 p-5 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
                <ArrowUpCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                <div className="text-left">
                  <p className="font-bold text-orange-700 dark:text-orange-400">Withdraw</p>
                  <p className="text-xs text-orange-600 dark:text-orange-500">Take money out</p>
                </div>
              </button>
            </div>

            {/* Transaction History */}
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center gap-2">
                <History size={18} className="text-gray-500 dark:text-gray-400" />
                <h3 className="font-semibold dark:text-white">Transaction History</h3>
              </div>
              {myTransactions.length === 0 ? (
                <div className="px-6 py-10 text-center text-gray-400 text-sm">No transactions yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <tr>
                      <th className="px-6 py-3 text-left">Date</th>
                      <th className="px-6 py-3 text-left">Type</th>
                      <th className="px-6 py-3 text-left">Note</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3 text-right">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {myTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-6 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateTime(t.transaction_date || t.created_at)}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            t.type === 'deposit' || t.type === 'transfer_in'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                          }`}>
                            {t.type === 'deposit' || t.type === 'transfer_in' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {t.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{t.note || '—'}</td>
                        <td className={`px-6 py-3 text-right font-semibold ${
                          t.type === 'deposit' || t.type === 'transfer_in' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                        }`}>
                          {t.type === 'deposit' || t.type === 'transfer_in' ? '+' : '-'}{formatCurrency(t.amount)}
                        </td>
                        <td className="px-6 py-3 text-right dark:text-white">{formatCurrency(t.balance_after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════
            STAFF VIEW
        ══════════════════════════════════════ */}
        {!isCustomer && (
          <>
            {/* Summary Card */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg flex justify-between items-center">
              <div>
                <p className="text-white/80 text-sm mb-1">Total Savings (All Customers)</p>
                <p className="text-3xl font-bold">{formatCurrency(totalSavings)}</p>
                <p className="text-white/70 text-xs mt-1">{savingsData.length} customer accounts</p>
              </div>
              <div className="p-4 bg-white/20 rounded-lg"><Wallet size={34} /></div>
            </div>

            {/* Tabs */}
            <div className="flex border-b dark:border-gray-700">
              {[
                { id: 'accounts', label: 'All Accounts' },
                { id: 'history', label: 'Transaction History' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Accounts Tab */}
            {activeTab === 'accounts' && (
              <div className="space-y-3">
                {/* Search */}
                <div className="relative max-w-sm">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search customer by name..."
                    className="w-full pl-9 pr-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
                  />
                </div>

                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 text-xs text-gray-500 dark:text-gray-300 uppercase">
                      <tr>
                        <th className="px-6 py-3 text-left">Customer</th>
                        <th className="px-6 py-3 text-right">Balance</th>
                        <th className="px-6 py-3 text-left">Last Updated</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredSavingsData.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-gray-400">
                            {searchTerm ? 'No customers match your search' : 'No savings accounts found'}
                          </td>
                        </tr>
                      ) : filteredSavingsData.map(row => (
                        <tr key={row.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                          <td className="px-6 py-4 font-medium dark:text-white">{row.name}</td>
                          <td className="px-6 py-4 text-right font-bold dark:text-white">{formatCurrency(row.balance)}</td>
                          <td className="px-6 py-4 text-gray-400">{formatDate(row.updated_at)}</td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => { setActiveTab('history'); loadCustomerHistory(row.user_id, row.name) }}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                                title="View History">
                                <History size={13} /> History
                              </button>
                              <button
                                onClick={() => openTxModal('deposit', row.user_id, row.name, row.balance)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg"
                                title="Deposit">
                                <ArrowDownCircle size={13} /> Deposit
                              </button>
                              <button
                                onClick={() => openTxModal('withdraw', row.user_id, row.name, row.balance)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-lg"
                                title="Withdraw">
                                <ArrowUpCircle size={13} /> Withdraw
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => setDeleteModal(row)}
                                  className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                  title="Delete">
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
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {/* Customer Selector */}
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-4">
                  <p className="text-sm font-medium dark:text-gray-300 mb-3">Select a customer to view transactions:</p>
                  <div className="relative max-w-sm mb-3">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search customer by name..."
                      className="w-full pl-9 pr-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filteredSavingsData.map(row => (
                      <button
                        key={row.user_id}
                        onClick={() => loadCustomerHistory(row.user_id, row.name)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                          selectedHistory?.user_id === row.user_id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}>
                        <User size={13} /> {row.name}
                        <span className={`text-xs ${selectedHistory?.user_id === row.user_id ? 'text-white/80' : 'text-gray-400'}`}>
                          {formatCurrency(row.balance)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transaction Table */}
                {selectedHistory && (
                  <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold dark:text-white">{selectedHistory.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Transaction history</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openTxModal('deposit', selectedHistory.user_id, selectedHistory.name,
                            savingsData.find(s => s.user_id === selectedHistory.user_id)?.balance || 0)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 rounded-lg">
                          <ArrowDownCircle size={13} /> Deposit
                        </button>
                        <button
                          onClick={() => openTxModal('withdraw', selectedHistory.user_id, selectedHistory.name,
                            savingsData.find(s => s.user_id === selectedHistory.user_id)?.balance || 0)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 rounded-lg">
                          <ArrowUpCircle size={13} /> Withdraw
                        </button>
                      </div>
                    </div>

                    {historyLoading ? (
                      <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                      </div>
                    ) : selectedHistory.txns.length === 0 ? (
                      <div className="px-6 py-10 text-center text-gray-400 text-sm">No transactions recorded yet</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
                          <tr>
                            <th className="px-6 py-3 text-left">Date</th>
                            <th className="px-6 py-3 text-left">Type</th>
                            <th className="px-6 py-3 text-left">Note</th>
                            <th className="px-6 py-3 text-left">Posted By</th>
                            <th className="px-6 py-3 text-right">Amount</th>
                            <th className="px-6 py-3 text-right">Balance After</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {selectedHistory.txns.map(t => (
                            <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                              <td className="px-6 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateTime(t.transaction_date || t.created_at)}</td>
                              <td className="px-6 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  t.type === 'deposit' || t.type === 'transfer_in'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                                }`}>
                                  {t.type === 'deposit' || t.type === 'transfer_in' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                  {t.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{t.note || '—'}</td>
                              <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{t.posted_by}</td>
                              <td className={`px-6 py-3 text-right font-semibold ${
                                t.type === 'deposit' || t.type === 'transfer_in' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                              }`}>
                                {t.type === 'deposit' || t.type === 'transfer_in' ? '+' : '-'}{formatCurrency(t.amount)}
                              </td>
                              <td className="px-6 py-3 text-right dark:text-white">{formatCurrency(t.balance_after)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {!selectedHistory && (
                  <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-10 text-center text-gray-400 text-sm">
                    Select a customer above to view their transaction history
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════
          Transaction Modal
      ══════════════════════════════════════ */}
      {txModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
              <div className="flex items-center gap-3">
                {txModal.type === 'deposit'
                  ? <ArrowDownCircle className="w-5 h-5 text-green-600" />
                  : <ArrowUpCircle className="w-5 h-5 text-orange-600" />}
                <div>
                  <h3 className="font-semibold dark:text-white capitalize">{txModal.type}</h3>
                  {txModal.name && <p className="text-xs text-gray-400">{txModal.name}</p>}
                </div>
              </div>
              <button onClick={() => setTxModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
            </div>

            <form onSubmit={handleTransaction} className="p-6 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Current Balance</p>
                <p className="text-xl font-bold dark:text-white">{formatCurrency(txModal.balance)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Amount (₦) *</label>
                <input
                  type="number" step="0.01" value={txAmount}
                  onChange={e => setTxAmount(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
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
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  required
                />
                {txDate && txDate !== todayStr() && (
                  <p className="text-xs text-amber-500 mt-1">This will be posted as a back-dated transaction</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Note (Optional)</label>
                <input
                  type="text" value={txNote}
                  onChange={e => setTxNote(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  placeholder="e.g. Monthly savings..."
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setTxModal(null)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={txLoading}
                  className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 text-sm font-medium ${
                    txModal.type === 'deposit' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
                  }`}>
                  {txLoading ? 'Processing...' : `Confirm ${txModal.type === 'deposit' ? 'Deposit' : 'Withdrawal'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          Transfer Modal (Staff only)
      ══════════════════════════════════════ */}
      {transferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
              <div className="flex items-center gap-3">
                <ArrowLeftRight className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold dark:text-white">Transfer Between Customers</h3>
              </div>
              <button onClick={() => setTransferModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
            </div>

            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">From Customer *</label>
                <select
                  value={transferFrom}
                  onChange={e => setTransferFrom(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  required
                >
                  <option value="">Select customer...</option>
                  {savingsData.map(row => (
                    <option key={row.user_id} value={row.user_id}>
                      {row.name} ({formatCurrency(row.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">To Customer *</label>
                <select
                  value={transferTo}
                  onChange={e => setTransferTo(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  required
                >
                  <option value="">Select customer...</option>
                  {savingsData.filter(row => String(row.user_id) !== String(transferFrom)).map(row => (
                    <option key={row.user_id} value={row.user_id}>
                      {row.name} ({formatCurrency(row.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Amount (₦) *</label>
                <input
                  type="number" step="0.01" value={transferAmount}
                  onChange={e => setTransferAmount(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  placeholder="0.00" required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Posting Date *</label>
                <input
                  type="date" value={transferDate} max={todayStr()}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Note (Optional)</label>
                <input
                  type="text" value={transferNote}
                  onChange={e => setTransferNote(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  placeholder="e.g. Reallocation..."
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setTransferModal(false)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={transferLoading}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
                  {transferLoading ? 'Processing...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          Delete Modal (Admin only)
      ══════════════════════════════════════ */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl p-6">
            <h3 className="text-lg font-semibold mb-2 dark:text-white">Delete Savings Account</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Are you sure you want to delete <strong className="dark:text-white">{deleteModal.name}</strong>'s savings account?
              Balance is <strong>{formatCurrency(deleteModal.balance)}</strong>. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} disabled={deleting}
                className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium">
                {deleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}