import client from './client'

export const getUsers = async (role = null, officerId = null, search = null) => {
  const params = []
  if (role) params.push(`role=${role}`)
  if (officerId) params.push(`officer_id=${officerId}`)
  if (search) params.push(`search=${encodeURIComponent(search)}`)  // NEW
  
  let url = '/users/'
  if (params.length > 0) {
    url += `?${params.join('&')}`
  }
  
  const { data } = await client.get(url)
  return data
}

export const getUser = async (userId) => {
  const { data } = await client.get(`/users/${userId}`)
  return data
}

export const getUserFinancialSummary = async (userId) => {
  const { data } = await client.get(`/users/${userId}/financial-summary`)
  return data
}

export const createUser = async (userData) => {
  const { data } = await client.post('/users/', userData)
  return data
}

export const updateUser = async (userId, userData) => {
  const { data } = await client.put(`/users/${userId}`, userData)
  return data
}

export const deleteUser = async (userId) => {
  const { data } = await client.delete(`/users/${userId}`)
  return data
}

export const assignOfficer = async (userId, officerId) => {
  const { data } = await client.put(`/users/${userId}/assign-officer`, { officer_id: officerId })
  return data
}

export const bulkAssignOfficer = async (customerIds, officerId) => {
  const { data } = await client.post('/users/bulk-assign-officer', {
    customer_ids: customerIds,
    officer_id: officerId
  })
  return data
}

export const syncOfficersFromLoans = async () => {
  const { data } = await client.post('/users/sync-officers-from-loans')
  return data
}