import client from './client'

export const getApplications = async (month = null, officerId = null, search = null) => {
  const params = []
  if (month) params.push(`month=${month}`)
  if (officerId) params.push(`officer_id=${officerId}`)
  if (search) params.push(`search=${encodeURIComponent(search)}`)
  const url = `/applications/${params.length ? '?' + params.join('&') : ''}`
  const { data } = await client.get(url)
  return data
}

export const createApplication = async (applicationData) => {
  const { data } = await client.post('/applications/', applicationData)
  return data
}

export const deleteApplication = async (applicationId) => {
  const { data } = await client.delete(`/applications/${applicationId}`)
  return data
}

export const updateApplication = async (applicationId, updateData) => {
  const { data } = await client.put(`/applications/${applicationId}`, updateData)
  return data
}

export const reviewApplication = async (id, reviewData) => {
  // reviewData: { action, comments, disbursement_date? }
  const { data } = await client.post(`/applications/${id}/review`, reviewData)
  return data
}

export const getUserApplications = async (userId) => {
  const { data } = await client.get(`/applications/user/${userId}`)
  return data
}