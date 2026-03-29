import { useState, useEffect } from 'react'
import client from '../api/client'
import Layout from '../components/Layout'
import { Users, UserCheck, Search, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CustomerAssignment() {
  const [customers, setCustomers] = useState([])
  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOfficer, setFilterOfficer] = useState('')
  const [selectedCustomers, setSelectedCustomers] = useState([])
  const [bulkOfficerId, setBulkOfficerId] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [customersRes, officersRes] = await Promise.all([
        client.get('/users/?role=customer'),
        client.get('/users/?role=loan_officer')
      ])
      setCustomers(customersRes.data)
      setOfficers(officersRes.data)
    } catch (err) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (customerId, officerId) => {
    try {
      await client.put(`/users/${customerId}/assign-officer`, { officer_id: officerId || null })
      toast.success('Officer assigned!')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign officer')
    }
  }

  const handleBulkAssign = async () => {
    if (selectedCustomers.length === 0) return toast.error('Select customers first')
    if (!bulkOfficerId) return toast.error('Select an officer')
    try {
      await client.post('/users/bulk-assign-officer', {
        customer_ids: selectedCustomers,
        officer_id: parseInt(bulkOfficerId)
      })
      toast.success(`${selectedCustomers.length} customers assigned!`)
      setSelectedCustomers([])
      setBulkOfficerId('')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign officers')
    }
  }

  const handleSyncFromLoans = async () => {
    try {
      const res = await client.post('/users/sync-officers-from-loans')
      toast.success(`${res.data.updated} customers updated from loan records!`)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to sync')
    }
  }

  const toggleSelectCustomer = (id) =>
    setSelectedCustomers(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])

  const toggleSelectAll = () =>
    setSelectedCustomers(selectedCustomers.length === filteredCustomers.length ? [] : filteredCustomers.map(c => c.id))

  const getOfficerName = (officerId) => {
    const o = officers.find(o => o.id === officerId)
    return o ? `${o.first_name} ${o.last_name}` : 'Unassigned'
  }

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesOfficer = !filterOfficer ||
      (filterOfficer === 'unassigned' ? !c.assigned_officer_id : c.assigned_officer_id === parseInt(filterOfficer))
    return matchesSearch && matchesOfficer
  })

  const unassignedCount = customers.filter(c => !c.assigned_officer_id).length

  if (loading) return (
    <Layout>
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Assignment</h1>
            <p className="text-gray-600 dark:text-gray-400">Assign customers to loan officers</p>
          </div>
          <button onClick={handleSyncFromLoans}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
            <RefreshCw className="w-4 h-4" /> Sync from Loans
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Customers', value: customers.length, icon: Users, color: 'blue' },
            { label: 'Assigned', value: customers.length - unassignedCount, icon: UserCheck, color: 'green' },
            { label: 'Unassigned', value: unassignedCount, icon: Users, color: 'orange' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 p-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 bg-${s.color}-100 dark:bg-${s.color}-900/30 rounded-lg`}>
                  <s.icon className={`w-6 h-6 text-${s.color}-600 dark:text-${s.color}-400`} />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{s.label}</p>
                  <p className="text-2xl font-bold dark:text-white">{s.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bulk Actions */}
        {selectedCustomers.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
            <span className="text-blue-800 dark:text-blue-300">{selectedCustomers.length} customers selected</span>
            <div className="flex items-center gap-3">
              <select value={bulkOfficerId} onChange={e => setBulkOfficerId(e.target.value)}
                className="border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white">
                <option value="">Select Officer</option>
                {officers.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
              </select>
              <button onClick={handleBulkAssign}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Assign Selected</button>
              <button onClick={() => setSelectedCustomers([])}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800">Clear</button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 p-4 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Search customers..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
          </div>
          <select value={filterOfficer} onChange={e => setFilterOfficer(e.target.value)}
            className="border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white">
            <option value="">All Officers</option>
            <option value="unassigned">Unassigned</option>
            {officers.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input type="checkbox"
                    checked={selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0}
                    onChange={toggleSelectAll} className="rounded" />
                </th>
                {['Customer', 'Email', 'Assigned Officer', 'Change Officer'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCustomers.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No customers found.</td></tr>
              ) : filteredCustomers.map(customer => (
                <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4">
                    <input type="checkbox" checked={selectedCustomers.includes(customer.id)}
                      onChange={() => toggleSelectCustomer(customer.id)} className="rounded" />
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {customer.first_name} {customer.last_name}
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{customer.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${customer.assigned_officer_id
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'}`}>
                      {getOfficerName(customer.assigned_officer_id)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select value={customer.assigned_officer_id || ''}
                      onChange={e => handleAssign(customer.id, e.target.value ? parseInt(e.target.value) : null)}
                      className="border dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-white">
                      <option value="">Unassigned</option>
                      {officers.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}