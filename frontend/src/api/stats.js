import client from './client'

export const getDashboardStats = async () => {
  const { data } = await client.get('/stats/dashboard')
  return data
}

export const getReports = async (filter = 'month', month = null) => {
  let url = `/stats/reports?filter=${filter}`
  if (filter === 'custom_month' && month) {
    url += `&month=${month}`
  }
  const { data } = await client.get(url)
  return data
}