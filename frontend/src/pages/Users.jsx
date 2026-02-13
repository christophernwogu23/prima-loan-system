import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import { getUsers, createUser, deleteUser } from '../api/users'
import toast from 'react-hot-toast'
import { Trash2, Plus, X, Eye, Edit2, PlusCircle, Search } from 'lucide-react'
import UserDetailsModal from '../components/UserDetailsModal'
import api from '../api/axios'
import ApplyForCustomerModal from '../components/ApplyForCustomerModal'

export default function Users() {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [applyingForCustomer, setApplyingForCustomer] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filterRole, setFilterRole] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    role: 'customer'
  })

const loadUsers = async () => {
  try {
    const data = await getUsers(filterRole || null, null, searchQuery || null)
    setUsers(data)
    setFilteredUsers(data)
  } catch (error) {
    console.error('Failed to load users:', error)
    toast.error('Failed to load users')
  } finally {
    setLoading(false)
  }
}

// Update the useEffect to trigger on search changes:
useEffect(() => {
  loadUsers()
}, [filterRole, searchQuery])

// Optional: Add debouncing to avoid too many API calls
useEffect(() => {
  const delaySearch = setTimeout(() => {
    loadUsers()
  }, 500) // Wait 500ms after user stops typing

  return () => clearTimeout(delaySearch)
}, [searchQuery, filterRole])

  const handleCreateUser = async (e) => {
    e.preventDefault()
    try {
      await createUser(formData)
      toast.success('User created successfully!')
      setShowModal(false)
      setFormData({ email: '', password: '', first_name: '', middle_name: '', last_name: '', role: 'customer' })
      loadUsers()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user')
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    
    try {
      await deleteUser(userId)
      toast.success('User deleted')
      loadUsers()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user')
    }
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    try {
      const updateData = {
        email: formData.email,
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        role: formData.role
      }
      
      // Only include password if it was changed
      if (formData.password) {
        updateData.password = formData.password
      }
      
      await api.put(`/users/${editingUser.id}`, updateData)
      toast.success('User updated successfully!')
      setShowModal(false)
      setEditingUser(null)
      setFormData({ email: '', password: '', first_name: '', middle_name: '', last_name: '', role: 'customer' })
      loadUsers()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user')
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
  }

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      ceo: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
      manager: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      loan_officer: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      customer: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    }
    return colors[role] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
  }

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      suspended: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
    }
    return colors[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold dark:text-white">Users</h2>
        <div className="flex gap-4">
          {/* Add User Button - Admin only */}
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Add User
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex gap-4 mb-6 flex-wrap">
        {/* Search Input */}
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Role Filter */}
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="ceo">CEO</option>
          <option value="manager">Manager</option>
          <option value="loan_officer">Loan Officer</option>
          <option value="customer">Customer</option>
        </select>
      </div>

      {/* Results Count */}
      {searchQuery && (
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Found {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
        </div>
      )}

      {loading ? (
        <p className="dark:text-white">Loading...</p>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No users found matching your search.' : 'No users found.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {user.first_name} {user.middle_name ? user.middle_name + ' ' : ''}{user.last_name}
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedUserId(user.id)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      {currentUser?.role === 'loan_officer' && user.role === 'customer' && (
                        <button
                          onClick={() => setApplyingForCustomer(user)}
                          className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                          title="Apply for Loan"
                        >
                          <PlusCircle size={18} />
                        </button>
                      )}
                      {currentUser?.role === 'admin' && (
                        <>
                          <button
                            onClick={() => {
                              setEditingUser(user)
                              setFormData({
                                email: user.email,
                                password: '',
                                first_name: user.first_name,
                                middle_name: user.middle_name || '',
                                last_name: user.last_name,
                                role: user.role
                              })
                              setShowModal(true)
                            }}
                            className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300"
                            title="Edit User"
                          >
                            <Edit2 size={18} />
                          </button>
                          {user.id !== currentUser.id && (
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                              title="Delete User"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h3>
              <button 
                onClick={() => {
                  setShowModal(false)
                  setEditingUser(null)
                  setFormData({ email: '', password: '', first_name: '', middle_name: '', last_name: '', role: 'customer' })
                }} 
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">First Name</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Middle Name Field */}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Middle Name <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.middle_name}
                  onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Password {editingUser && <span className="text-gray-400 dark:text-gray-500 font-normal">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={!editingUser}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="customer">Customer</option>
                  <option value="loan_officer">Loan Officer</option>
                  <option value="manager">Manager</option>
                  <option value="ceo">CEO</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedUserId && (
        <UserDetailsModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}

      {/* Apply for Customer Modal */}
      {applyingForCustomer && (
        <ApplyForCustomerModal
          customer={applyingForCustomer}
          onClose={() => setApplyingForCustomer(null)}
          onSuccess={() => setApplyingForCustomer(null)}
        />
      )}
    </Layout>
  )
}