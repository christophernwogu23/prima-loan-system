import client from './client'

export const getPayments = async (month = null) => {
  let url = '/payments/'
  if (month) {
    url += `?month=${month}`
  }
  const { data } = await client.get(url)
  return data
}

export const createPayment = async (paymentData) => {
  const { data } = await client.post('/payments/', paymentData)
  return data
}

export const updatePayment = async (paymentId, paymentData) => {
  const { data } = await client.put(`/payments/${paymentId}`, paymentData)
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

export const getPaymentSummary = async (loanId) => {
  const { data } = await client.get(`/payments/summary/${loanId}`)
  return data
}

export const getDisbursedLoans = async () => {
  const { data } = await client.get('/payments/disbursed-loans')
  return data
}