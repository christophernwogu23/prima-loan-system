import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import { Plus, X, Eye, BookOpen } from 'lucide-react'
import client from '../../api/client'

export default function ChartOfAccounts() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterType, setFilterType] = useState('')
  
  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    account_type: 'asset',
    description: ''
  })

  const accountTypes = [
  { value: 'asset', label: 'Assets', color: 'text-blue-600 dark:text-blue-400' },
  { value: 'liability', label: 'Liabilities', color: 'text-red-600 dark:text-red-400' },
  { value: 'equity', label: 'Equity', color: 'text-purple-600 dark:text-purple-400' },
  { value: 'income', label: 'Income', color: 'text-green-600 dark:text-green-400' },
  { value: 'expense', label: 'Expenses', color: 'text-orange-600 dark:text-orange-400' }
]

  useEffect(() => {
    loadAccounts()
  }, [filterType])

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const params = filterType ? `?account_type=${filterType}` : ''
      const response = await client.get(`/gl/accounts${params}`)
      setAccounts(response.data)
    } catch (error) {
      console.error('Failed to load GL accounts:', error)
      toast.error('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await client.post('/gl/accounts', formData)
      toast.success('GL account created!')
      setShowModal(false)
      setFormData({
        account_code: '',
        account_name: '',
        account_type: 'asset',
        description: ''
      })
      loadAccounts()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create account')
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getTypeColor = (type) => {
    const typeObj = accountTypes.find(t => t.value === type)
    return typeObj ? typeObj.color : 'text-gray-600'
  }

  const groupedAccounts = accountTypes.map(type => ({
    ...type,
    accounts: accounts.filter(acc => acc.account_type === type.value)
  }))

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">Chart of Accounts</h2>
            <p className="text-gray-600 dark:text-gray-400">Manage General Ledger accounts</p>
          </div>
          
          <div className="flex gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Types</option>
              {accountTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            {user?.role === 'admin' && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} />
                Add Account
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedAccounts.map(group => (
              group.accounts.length > 0 && (
                <div key={group.value} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 border-b dark:border-gray-600">
                    <h3 className={`font-semibold ${group.color}`}>{group.label}</h3>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-600">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Account Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Balance</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {group.accounts.map(account => (
                        <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 text-sm font-mono font-medium dark:text-white">
                            {account.account_code}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium dark:text-white">
                            {account.account_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {account.description || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-right dark:text-white">
                            {formatCurrency(account.current_balance)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => navigate(`/gl/accounts/${account.id}`)}
                              className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                              title="View Transactions"
                            >
                              <Eye size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* Create Account Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Create GL Account</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Account Code *</label>
                <input
                  type="text"
                  value={formData.account_code}
                  onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-mono"
                  placeholder="e.g., 1007"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Account Name *</label>
                <input
                  type="text"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., Petty Cash"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Account Type *</label>
                <select
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                >
                  {accountTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  rows="2"
                  placeholder="Optional description..."
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
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}