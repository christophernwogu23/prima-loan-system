import client from './client'

export const getMyNotifications = async () => {
  const { data } = await client.get('/notifications/')
  return data
}

export const markAsRead = async (notificationId) => {
  const { data } = await client.patch(`/notifications/${notificationId}/read`)
  return data
}

export const markAllAsRead = async () => {
  const { data } = await client.post('/notifications/mark-all-read')
  return data
}