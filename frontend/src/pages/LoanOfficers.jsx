import { useState, useEffect } from 'react'
import api from '../api/axios'
import Layout from '../components/Layout'
import { Eye, Edit2, Trash2, Plus, X, User } from 'lucide-react'
import toast from 'react-hot-toast'
import UserDetailsModal from '../components/UserDetailsModal'

export default function LoanOfficers() {
  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingOfficer, setEditingOfficer] = useState(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: ''
  })

  useEffect(() => {
    fetchOfficers()
  }, [])

  const fetchOfficers = async () => {
    try {
      const res = await api.get('/users?role=loan_officer')
      setOfficers(res.data)
    } catch (err) {
      console.error('Failed to fetch loan officers:', err)
      toast.error('Failed to load loan officers')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.post('/users', {
        ...formData,
        role: 'loan_officer'
      })
      toast.success('Loan officer created!')
      setShowModal(false)
      setFormData({ email: '', password: '', first_name: '', last_name: '' })
      fetchOfficers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create loan officer')
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      const updateData = {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        role: 'loan_officer'
      }
      if (formData.password) {
        updateData.password = formData.password
      }
      
      await api.put(`/users/${editingOfficer.id}`, updateData)
      toast.success('Loan officer updated!')
      setShowModal(false)
      setEditingOfficer(null)
      setFormData({ email: '', password: '', first_name: '', last_name: '' })
      fetchOfficers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update loan officer')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this loan officer?')) return
    
    try {
      await api.delete(`/users/${id}`)
      toast.success('Loan officer deleted')
      fetchOfficers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete loan officer')
    }
  }

  const openEditModal = (officer) => {
    setEditingOfficer(officer)
    setFormData({
      email: officer.email,
      password: '',
      first_name: officer.first_name,
      last_name: officer.last_name
    })
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingOfficer(null)
    setFormData({ email: '', password: '', first_name: '', last_name: '' })
    setShowModal(true)
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Loan Officers</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage loan officers</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Loan Officer
          </button>
        </div>

        {/* Summary Card */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6 w-fit">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <User className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Loan Officers</p>
              <p className="text-2xl font-bold dark:text-white">{officers.length}</p>
            </div>
          </div>
        </div>

        {/* Officers Table */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {officers.map((officer) => (
                <tr key={officer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {officer.first_name} {officer.last_name}
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{officer.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      officer.status === 'active' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    }`}>
                      {officer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {new Date(officer.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedUserId(officer.id)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => openEditModal(officer)}
                        className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(officer.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {officers.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No loan officers found. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">
                {editingOfficer ? 'Edit Loan Officer' : 'Add Loan Officer'}
              </h2>
              <button 
                onClick={() => {
                  setShowModal(false)
                  setEditingOfficer(null)
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingOfficer ? handleUpdate : handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password {editingOfficer && <span className="text-gray-400 dark:text-gray-500 font-normal">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={!editingOfficer}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingOfficer(null)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingOfficer ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUserId && (
        <UserDetailsModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </Layout>
  )
}