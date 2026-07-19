import client from './client'

export const getMySavings = async () => {
  const { data } = await client.get('/savings/my-balance')
  return data
}

export const getAllSavings = async () => {
  const { data } = await client.get('/savings/')
  return data
}

export const getUserSavings = async (userId) => {
  const { data } = await client.get(`/savings/user/${userId}`)
  return data
}

export const depositSavings = async (userId, amount, note = null, transactionDate = null) => {
  const { data } = await client.post('/savings/deposit', {
    user_id: userId,
    amount,
    note,
    transaction_date: transactionDate
  })
  return data
}

export const withdrawSavings = async (userId, amount, note = null, transactionDate = null) => {
  const { data } = await client.post('/savings/withdraw', {
    user_id: userId,
    amount,
    note,
    transaction_date: transactionDate
  })
  return data
}

export const transferSavings = async (fromUserId, toUserId, amount, note = null, transactionDate = null) => {
  const { data } = await client.post('/savings/transfer', {
    from_user_id: fromUserId,
    to_user_id: toUserId,
    amount,
    note,
    transaction_date: transactionDate
  })
  return data
}

export const getSavingsSummary = async () => {
  const { data } = await client.get('/savings/summary')
  return data
}