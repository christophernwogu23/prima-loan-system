import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, X, Building, CheckCircle, Trash2 } from 'lucide-react'
import api from '../../api/api'

export default function TransitAccount() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [deposits, setDeposits] = useState([])
  const [stats, setStats] = useState({ pending_balance: 0, pending_count: 0 })
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(null)
  const [showAll, setShowAll] = useState(false)
  
  const [formData, setFormData] = useState({
    amount: '',
    collector_name: '',
    collection_date: new Date().toISOString().slice(0, 16),
    reference_number: '',
    notes: ''
  })
  
  const [bankDepositData, setBankDepositData] = useState({
    reference_number: ''
  })

  const canRecord = ['admin', 'manager', 'loan_officer'].includes(user?.role)
  const canDeposit = ['admin', 'manager'].includes(user?.role)

  useEffect(() => {
    loadData()
  }, [showAll])

  const loadData = async () => {
    setLoading(true)
    try {
      const [depositsRes, statsRes] = await Promise.all([
        api.get(`/transit/?show_deposited=${showAll}`),
        api.get('/transit/stats')
      ])
      setDeposits(depositsRes.data)
      setStats(statsRes.data)
    } catch (error) {
      console.error('Failed to load transit data:', error)
      toast.error('Failed to load transit account')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/transit/', {
        ...formData,
        amount: parseFloat(formData.amount)
      })
      toast.success('Transit deposit recorded!')
      setShowModal(false)
      setFormData({
        amount: '',
        collector_name: '',
        collection_date: new Date().toISOString().slice(0, 16),
        reference_number: '',
        notes: ''
      })
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record deposit')
    }
  }

  const handleDepositToBank = async (depositId) => {
    try {
      await api.post(`/transit/${depositId}/deposit-to-bank`, bankDepositData)
      toast.success('Deposited to bank successfully!')
      setShowDepositModal(null)
      setBankDepositData({ reference_number: '' })
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to deposit to bank')
    }
  }

  const handleDelete = async (depositId) => {
    if (!confirm('Delete this transit deposit?')) return
    try {
      await api.delete(`/transit/${depositId}`)
      toast.success('Deposit deleted')
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/accounts')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ArrowLeft size={20} className="dark:text-white" />
            </button>
            <div>
              <h2 className="text-2xl font-bold dark:text-white">Transit Account</h2>
              <p className="text-gray-600 dark:text-gray-400">Late cash collections pending bank deposit</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowAll(!showAll)}
              className="px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {showAll ? 'Show Pending Only' : 'Show All'}
            </button>
            {canRecord && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} />
                Add Deposit
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-6 rounded-lg">
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Pending Balance</p>
            <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{formatCurrency(stats.pending_balance)}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Pending Deposits</p>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.pending_count}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total All Time</p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-300">{formatCurrency(stats.total_amount || 0)}</p>
          </div>
        </div>

        {/* Deposits Table */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Collector</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : deposits.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No transit deposits found
                  </td>
                </tr>
              ) : (
                deposits.map((deposit) => (
                  <tr key={deposit.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {formatDate(deposit.collection_date)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {deposit.collector_name}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-right text-orange-600 dark:text-orange-400">
                      {formatCurrency(deposit.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {deposit.reference_number || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {deposit.deposited_to_bank ? (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded-full">
                          Banked {deposit.bank_deposit_date ? `(${new Date(deposit.bank_deposit_date).toLocaleDateString()})` : ''}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs font-medium rounded-full">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {!deposit.deposited_to_bank && canDeposit && (
                          <button
                            onClick={() => setShowDepositModal(deposit)}
                            className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                            title="Deposit to Bank"
                          >
                            <Building size={18} />
                          </button>
                        )}
                        {!deposit.deposited_to_bank && user?.role === 'admin' && (
                          <button
                            onClick={() => handleDelete(deposit.id)}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Deposit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Record Transit Deposit</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Amount (₦) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Collector Name *</label>
                <input
                  type="text"
                  value={formData.collector_name}
                  onChange={(e) => setFormData({ ...formData, collector_name: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Who collected this cash?"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Collection Date *</label>
                <input
                  type="datetime-local"
                  value={formData.collection_date}
                  onChange={(e) => setFormData({ ...formData, collection_date: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Reference Number</label>
                <input
                  type="text"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Receipt number, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  rows="2"
                  placeholder="Additional details..."
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
                  Record Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit to Bank Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Deposit to Bank</h3>
              <button onClick={() => setShowDepositModal(null)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Amount:</strong> {formatCurrency(showDepositModal.amount)}
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Collector:</strong> {showDepositModal.collector_name}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Bank Reference Number</label>
                <input
                  type="text"
                  value={bankDepositData.reference_number}
                  onChange={(e) => setBankDepositData({ reference_number: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Bank deposit slip number"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowDepositModal(null)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDepositToBank(showDepositModal.id)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  Confirm Deposit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}