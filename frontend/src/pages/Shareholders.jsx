import { useState, useEffect } from 'react'
import api from '../api/axios'
import Layout from '../components/Layout'
import { Users, Plus, Edit2, Trash2, X } from 'lucide-react'

export default function Shareholders() {
  const [shareholders, setShareholders] = useState([])
  const [summary, setSummary] = useState({ total_capital: 0, shareholder_count: 0 })
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ name: '', capital: '', notes: '' })
  const [error, setError] = useState('')

  const fetchData = async () => {
    try {
      const [shareholdersRes, summaryRes] = await Promise.all([
        api.get('/shareholders'),
        api.get('/shareholders/summary')
      ])
      setShareholders(shareholdersRes.data)
      setSummary(summaryRes.data)
    } catch (err) {
      console.error('Failed to fetch shareholders:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const handleSubmit = async (e) => {
  e.preventDefault()
  setError('')

  try {
    const payload = {
      name: formData.name,
      capital: parseFloat(formData.capital),
      notes: formData.notes || null
    }

    if (editingId) {
      await api.put(`/shareholders/${editingId}`, payload)
    } else {
      await api.post('/shareholders', payload)
    }

    setShowModal(false)
    setEditingId(null)
    setFormData({ name: '', capital: '', notes: '' })
    fetchData()
  } catch (err) {
    console.error('Shareholder error:', err)
    
    // Handle different error formats
    if (err.response?.data?.detail) {
      // Check if detail is array (FastAPI validation errors)
      if (Array.isArray(err.response.data.detail)) {
        const errorMessages = err.response.data.detail.map(e => e.msg).join(', ')
        setError(errorMessages)
      } else if (typeof err.response.data.detail === 'string') {
        setError(err.response.data.detail)
      } else {
        setError('Failed to save shareholder')
      }
    } else {
      setError(err.message || 'Failed to save shareholder')
    }
  }
}

  const handleEdit = (shareholder) => {
    setEditingId(shareholder.id)
    setFormData({
      name: shareholder.name,
      capital: shareholder.capital.toString(),
      notes: shareholder.notes || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this shareholder?')) return

    try {
      await api.delete(`/shareholders/${id}`)
      fetchData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete shareholder')
    }
  }

  const getOwnershipPercent = (capital) => {
    if (summary.total_capital === 0) return 0
    return ((capital / summary.total_capital) * 100).toFixed(2)
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shareholders</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage shareholder capital</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null)
              setFormData({ name: '', capital: '', notes: '' })
              setShowModal(true)
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Shareholder
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Shareholders</p>
                <p className="text-2xl font-bold dark:text-white">{summary.shareholder_count}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Capital</p>
                <p className="text-2xl font-bold dark:text-white">{formatCurrency(summary.total_capital)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Shareholders Table */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Capital</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ownership %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Notes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {shareholders.map((shareholder) => (
                <tr key={shareholder.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                    {shareholder.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                    {formatCurrency(shareholder.capital)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(getOwnershipPercent(shareholder.capital), 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{getOwnershipPercent(shareholder.capital)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">
                    {shareholder.notes || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(shareholder)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(shareholder.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {shareholders.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No shareholders found. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">
                {editingId ? 'Edit Shareholder' : 'Add Shareholder'}
              </h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capital (₦)</label>
                <input
                  type="number"
                  value={formData.capital}
                  onChange={(e) => setFormData({ ...formData, capital: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}