import client from './client'

export const getApplications = async (month = null) => {
  let url = '/applications/'
  if (month) {
    url += `?month=${month}`
  }
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
  const { data } = await client.post(`/applications/${id}/review`, reviewData)
  return data
}