import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import client from '../../api/client'

export default function AccountDetail() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const [account, setAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAccountData()
  }, [accountId])

  const loadAccountData = async () => {
    setLoading(true)
    try {
      const response = await client.get(`/gl/accounts/${accountId}/transactions`)
      setAccount(response.data.account)
      setTransactions(response.data.transactions)
    } catch (error) {
      console.error('Failed to load account data:', error)
    } finally {
      setLoading(false)
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
    const colors = {
      asset: 'text-blue-600 dark:text-blue-400',
      liability: 'text-red-600 dark:text-red-400',
      equity: 'text-purple-600 dark:text-purple-400',
      income: 'text-green-600 dark:text-green-400',
      expense: 'text-orange-600 dark:text-orange-400'
    }
    return colors[type] || 'text-gray-600'
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  if (!account) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-gray-500 dark:text-gray-400">Account not found</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/gl/chart-of-accounts')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft size={20} className="dark:text-white" />
          </button>
          <div>
            <h2 className="text-2xl font-bold dark:text-white">{account.account_name}</h2>
            <p className="text-gray-600 dark:text-gray-400">
              {account.account_code} · {account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)}
            </p>
          </div>
        </div>

        {/* Account Summary */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Balance</p>
              <p className={`text-3xl font-bold ${getTypeColor(account.account_type)}`}>
                {formatCurrency(account.current_balance)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Transactions</p>
              <p className="text-3xl font-bold dark:text-white">{transactions.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Account Type</p>
              <p className="text-xl font-semibold dark:text-white capitalize">{account.account_type}</p>
            </div>
          </div>
          {account.description && (
            <div className="mt-4 pt-4 border-t dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">{account.description}</p>
            </div>
          )}
        </div>

        {/* Transactions */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h3 className="font-semibold dark:text-white">Transaction History</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Entry #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Debit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No transactions yet
                  </td>
                </tr>
              ) : (
                transactions.map(txn => (
                  <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm dark:text-white">
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono dark:text-white">{txn.entry_number}</td>
                    <td className="px-6 py-4 text-sm dark:text-gray-300">
                      {txn.description}
                      {txn.reference && (
                        <span className="block text-xs text-gray-400">Ref: {txn.reference}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-right text-red-600 dark:text-red-400">
                      {txn.debit > 0 ? formatCurrency(txn.debit) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-right text-green-600 dark:text-green-400">
                      {txn.credit > 0 ? formatCurrency(txn.credit) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}