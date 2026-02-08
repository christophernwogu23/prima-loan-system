import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import { 
  getFixedDeposits, 
  createFixedDeposit, 
  updateFixedDeposit, 
  deleteFixedDeposit, 
  getFixedDepositsSummary 
} from '../api/fixedDeposits'
import { Plus, X, Trash2, Edit2, Landmark, Calendar, AlertTriangle, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

export default function FixedDeposits() {
  const { user } = useAuthStore()
  const [deposits, setDeposits] = useState([])
  const [summary, setSummary] = useState({ total_amount: 0, total_interest: 0, active_count: 0, maturing_soon: 0 })
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingDeposit, setEditingDeposit] = useState(null)
  const [formData, setFormData] = useState({
    depositor_name: '',
    amount: '',
    interest_amount: '',
    value_date: '',
    maturity_date: '',
    duration: '6 MONTHS',
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [depositsData, summaryData] = await Promise.all([
        getFixedDeposits(),
        getFixedDepositsSummary()
      ])
      setDeposits(depositsData)
      setSummary(summaryData)
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load fixed deposits')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      depositor_name: '',
      amount: '',
      interest_amount: '',
      value_date: '',
      maturity_date: '',
      duration: '6 MONTHS',
      notes: ''
    })
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
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.depositor_name || !formData.amount || !formData.value_date || !formData.maturity_date) {
      toast.error('Please fill in required fields')
      return
    }

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
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save fixed deposit')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this fixed deposit?')) return
    
    try {
      await deleteFixedDeposit(id)
      toast.success('Fixed deposit deleted')
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete')
    }
  }

  const handleStatusChange = async (deposit, newStatus) => {
    try {
      await updateFixedDeposit(deposit.id, { status: newStatus })
      toast.success(`Status updated to ${newStatus}`)
      loadData()
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      matured: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      withdrawn: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    }
    return colors[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
  }

  const isMaturing = (maturityDate) => {
    const thirtyDays = new Date()
    thirtyDays.setDate(thirtyDays.getDate() + 30)
    return new Date(maturityDate) <= thirtyDays
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fixed Deposits</h1>
            <p className="text-gray-600 dark:text-gray-400">Track investor fixed deposits</p>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Deposit
            </button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-6 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Landmark className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Deposits</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(summary.total_amount)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-6 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Interest</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(summary.total_interest)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-6 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Deposits</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.active_count}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-6 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Maturing Soon</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.maturing_soon}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Deposits Table */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Depositor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Interest</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Value Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Maturity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                {user?.role === 'admin' && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {deposits.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 8 : 7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No fixed deposits recorded yet
                  </td>
                </tr>
              ) : (
                deposits.map((deposit) => (
                  <tr 
                    key={deposit.id} 
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      isMaturing(deposit.maturity_date) && deposit.status === 'active' 
                        ? 'bg-orange-50 dark:bg-orange-900/20' 
                        : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {deposit.depositor_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {formatCurrency(deposit.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 font-medium">
                      {formatCurrency(deposit.interest_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(deposit.value_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(deposit.maturity_date)}
                      {isMaturing(deposit.maturity_date) && deposit.status === 'active' && (
                        <span className="ml-2 text-orange-600 dark:text-orange-400">⚠️</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {deposit.duration}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user?.role === 'admin' ? (
                        <select
                          value={deposit.status}
                          onChange={(e) => handleStatusChange(deposit, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-full border-0 ${getStatusColor(deposit.status)}`}
                        >
                          <option value="active">Active</option>
                          <option value="matured">Matured</option>
                          <option value="withdrawn">Withdrawn</option>
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(deposit.status)}`}>
                          {deposit.status}
                        </span>
                      )}
                    </td>
                    {user?.role === 'admin' && (
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleOpenModal(deposit)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mr-3"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(deposit.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">
                {editingDeposit ? 'Edit Fixed Deposit' : 'Add Fixed Deposit'}
              </h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Depositor Name *
                </label>
                <input
                  type="text"
                  value={formData.depositor_name}
                  onChange={(e) => setFormData({ ...formData, depositor_name: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter depositor name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount (₦) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Interest (₦) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.interest_amount}
                    onChange={(e) => setFormData({ ...formData, interest_amount: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Value Date *
                  </label>
                  <input
                    type="date"
                    value={formData.value_date}
                    onChange={(e) => setFormData({ ...formData, value_date: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Maturity Date *
                  </label>
                  <input
                    type="date"
                    value={formData.maturity_date}
                    onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Duration
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="3 MONTHS">3 Months</option>
                  <option value="6 MONTHS">6 Months</option>
                  <option value="12 MONTHS">12 Months</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingDeposit ? 'Update' : 'Add Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}