import client from './client'

export const getLoanProducts = async () => {
  const { data } = await client.get('/loan-products')
  return data
}

export const deleteLoanProduct = async (productId) => {
  const { data } = await client.delete(`/loan-products/${productId}`)
  return data
}