import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import { getUsers, createUser, deleteUser, updateUser } from '../api/users'
import toast from 'react-hot-toast'
import { Trash2, Plus, X, Eye, Edit2, Search } from 'lucide-react'

export default function Users() {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
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

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers()
    }, 300)
    return () => clearTimeout(timer)
  }, [filterRole, searchQuery])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await getUsers(filterRole || null, null, searchQuery || null)
      setUsers(data)
    } catch (error) {
      console.error('Failed to load users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    try {
      await createUser(formData)
      toast.success('User created!')
      setShowModal(false)
      setFormData({ email: '', password: '', first_name: '', middle_name: '', last_name: '', role: 'customer' })
      loadUsers()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user')
    }
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    try {
      await updateUser(editingUser.id, formData)
      toast.success('User updated!')
      setShowModal(false)
      setEditingUser(null)
      setFormData({ email: '', password: '', first_name: '', middle_name: '', last_name: '', role: 'customer' })
      loadUsers()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user')
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Delete this user?')) return
    try {
      await deleteUser(userId)
      toast.success('User deleted')
      loadUsers()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user')
    }
  }

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      ceo: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
      manager: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      loan_officer: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      customer: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    }
    return colors[role] || colors.customer
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold dark:text-white">Users</h2>
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            Add User
          </button>
        )}
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="ceo">CEO</option>
          <option value="manager">Manager</option>
          <option value="loan_officer">Loan Officer</option>
          <option value="customer">Customer</option>
        </select>
      </div>

      {loading ? (
        <p className="dark:text-white">Loading...</p>
      ) : users.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No users found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Joined</th>
                {currentUser?.role === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {user.first_name} {user.middle_name || ''} {user.last_name}
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  {currentUser?.role === 'admin' && (
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
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
                          className="text-yellow-600 hover:text-yellow-800"
                        >
                          <Edit2 size={18} />
                        </button>
                        {user.id !== currentUser.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">
                {editingUser ? 'Edit User' : 'Create User'}
              </h3>
              <button 
                onClick={() => {
                  setShowModal(false)
                  setEditingUser(null)
                  setFormData({ email: '', password: '', first_name: '', middle_name: '', last_name: '', role: 'customer' })
                }} 
                className="text-gray-500 hover:text-gray-700"
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
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Middle Name (optional)</label>
                <input
                  type="text"
                  value={formData.middle_name}
                  onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Password {editingUser && '(leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  required={!editingUser}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
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
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}