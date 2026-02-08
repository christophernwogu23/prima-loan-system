import client from './client'

export const getSettings = async () => {
  const { data } = await client.get('/settings/')
  return data
}

export const updateSettings = async (settings) => {
  const { data } = await client.put('/settings/bulk', settings)
  return data
}

export const updateSetting = async (key, value) => {
  const { data } = await client.put('/settings/', { key, value })
  return data
}