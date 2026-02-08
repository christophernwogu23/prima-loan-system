import client from './client'

export const getFixedDeposits = async () => {
  const { data } = await client.get('/fixed-deposits/')
  return data
}

export const createFixedDeposit = async (deposit) => {
  const { data } = await client.post('/fixed-deposits/', deposit)
  return data
}

export const updateFixedDeposit = async (id, deposit) => {
  const { data } = await client.put(`/fixed-deposits/${id}`, deposit)
  return data
}

export const deleteFixedDeposit = async (id) => {
  const { data } = await client.delete(`/fixed-deposits/${id}`)
  return data
}

export const getFixedDepositsSummary = async () => {
  const { data } = await client.get('/fixed-deposits/summary')
  return data
}