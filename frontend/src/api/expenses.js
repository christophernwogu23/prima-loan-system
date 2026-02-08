import client from './client'

export const getExpenses = async () => {
  const { data } = await client.get('/expenses/')
  return data
}

export const createExpense = async (expense) => {
  const { data } = await client.post('/expenses/', expense)
  return data
}

export const deleteExpense = async (id) => {
  const { data } = await client.delete(`/expenses/${id}`)
  return data
}

export const getExpenseCategories = async () => {
  const { data } = await client.get('/expenses/categories')
  return data
}

export const getExpenseSummary = async () => {
  const { data } = await client.get('/expenses/summary')
  return data
}