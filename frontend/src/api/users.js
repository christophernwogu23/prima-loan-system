import client from './client'

export const getUsers = async (role = null) => {
  let url = '/users/'
  if (role) {
    url += `?role=${role}`
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