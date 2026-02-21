import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import { Plus, X, Trash2, BookOpen, TrendingUp, TrendingDown } from 'lucide-react'
import client from '../../api/client'

export default function JournalEntries() {
  const { user } = useAuthStore()
  const [entries, setEntries] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    debit_account_id: '',
    credit_account_id: '',
    amount: '',
    description: '',
    reference: ''
  })

  const canCreate = ['admin', 'manager'].includes(user?.role)
  const canDelete = user?.role === 'admin'

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      
      const [entriesRes, accountsRes] = await Promise.all([
        client.get(`/gl/entries?${params}`),
        client.get('/gl/accounts')
      ])
      
      setEntries(entriesRes.data)
      setAccounts(accountsRes.data)
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load journal entries')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.debit_account_id || !formData.credit_account_id || !formData.amount) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      await client.post('/gl/entries', {
        ...formData,
        debit_account_id: parseInt(formData.debit_account_id),
        credit_account_id: parseInt(formData.credit_account_id),
        amount: parseFloat(formData.amount)
      })
      toast.success('Journal entry created!')
      setShowModal(false)
      setFormData({
        entry_date: new Date().toISOString().split('T')[0],
        debit_account_id: '',
        credit_account_id: '',
        amount: '',
        description: '',
        reference: ''
      })
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create entry')
    }
  }

  const handleDelete = async (entryId) => {
    if (!confirm('Delete this journal entry? Account balances will be reversed.')) return
    
    try {
      await client.delete(`/gl/entries/${entryId}`)
      toast.success('Journal entry deleted')
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete')
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId)
    return account ? `${account.account_code} - ${account.account_name}` : 'Unknown'
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">Journal Entries</h2>
            <p className="text-gray-600 dark:text-gray-400">Record financial transactions</p>
          </div>
          
          {canCreate && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} />
              New Entry
            </button>
          )}
        </div>

        {/* Date Filter */}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
              className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Entries Table */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Entry #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Debit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Credit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                {canDelete && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={canDelete ? 8 : 7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 8 : 7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No journal entries found
                  </td>
                </tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm font-mono font-medium dark:text-white">
                      {entry.entry_number}
                    </td>
                    <td className="px-6 py-4 text-sm dark:text-white">
                      {new Date(entry.entry_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm dark:text-gray-300">
                      {entry.description}
                      {entry.reference && (
                        <span className="block text-xs text-gray-400">Ref: {entry.reference}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm dark:text-white">
                      <div className="flex items-center gap-1">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        {getAccountName(entry.debit_account_id)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm dark:text-white">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        {getAccountName(entry.credit_account_id)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-right dark:text-white">
                      {formatCurrency(entry.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        entry.is_auto_generated 
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}>
                        {entry.is_auto_generated ? 'Auto' : 'Manual'}
                      </span>
                    </td>
                    {canDelete && (
                      <td className="px-6 py-4 text-right">
                        {!entry.is_auto_generated && (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">New Journal Entry</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Double-Entry Accounting:</strong> Every transaction affects two accounts.
                Debit one account (money out/expense), Credit another (money in/income).
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Date *</label>
                <input
                  type="date"
                  value={formData.entry_date}
                  onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
                  <label className="block text-sm font-medium mb-2 text-red-700 dark:text-red-400 flex items-center gap-2">
                    <TrendingDown size={16} />
                    Debit Account (From) *
                  </label>
                  <select
                    value={formData.debit_account_id}
                    onChange={(e) => setFormData({ ...formData, debit_account_id: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Select account...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_code} - {acc.account_name} ({formatCurrency(acc.current_balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border-2 border-green-200 dark:border-green-800 rounded-lg p-4">
                  <label className="block text-sm font-medium mb-2 text-green-700 dark:text-green-400 flex items-center gap-2">
                    <TrendingUp size={16} />
                    Credit Account (To) *
                  </label>
                  <select
                    value={formData.credit_account_id}
                    onChange={(e) => setFormData({ ...formData, credit_account_id: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Select account...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_code} - {acc.account_name} ({formatCurrency(acc.current_balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Amount (₦) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  rows="2"
                  placeholder="What is this transaction for?"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Reference (Optional)</label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Invoice #, Receipt #, etc."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}