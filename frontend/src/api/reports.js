import client from './client'

export const exportReport = async (reportType, startDate = null, endDate = null) => {
  const params = []
  if (startDate) params.push(`start_date=${startDate}`)
  if (endDate) params.push(`end_date=${endDate}`)
  
  const url = `/reports/export/${reportType}${params.length > 0 ? '?' + params.join('&') : ''}`
  
  const response = await client.get(url, {
    responseType: 'blob'
  })
  
  return response.data
}