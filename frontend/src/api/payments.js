import client from './client'

export const getPayments = async (month = null, officerId = null) => {
  const params = []
  if (month) params.push(`month=${month}`)
  if (officerId) params.push(`officer_id=${officerId}`)
  
  let url = '/payments/'
  if (params.length > 0) {
    url += `?${params.join('&')}`
  }
  
  const { data } = await client.get(url)
  return data
}

export const createPayment = async (paymentData) => {
  const { data } = await client.post('/payments/', paymentData)
  return data
}

export const updatePayment = async (paymentId, updateData) => {
  const { data } = await client.put(`/payments/${paymentId}`, updateData)
  return data
}

export const deletePayment = async (paymentId) => {
  const { data } = await client.delete(`/payments/${paymentId}`)
  return data
}

export const getLoanPayments = async (loanId) => {
  const { data } = await client.get(`/payments/loan/${loanId}`)
  return data
}

export const getLoanPaymentSummary = async (loanId) => {
  const { data } = await client.get(`/payments/summary/${loanId}`)
  return data
}

export const getDisbursedLoans = async () => {
  const { data } = await client.get('/payments/disbursed-loans')
  return data
}