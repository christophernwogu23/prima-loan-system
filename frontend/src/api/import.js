import client from './client'

export const previewImport = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const { data } = await client.post('/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data
}

export const importSavings = async (file, sheetName) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const { data } = await client.post(`/import/savings?sheet_name=${encodeURIComponent(sheetName)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data
}

export const importLoans = async (file, sheetName) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const { data } = await client.post(`/import/loans?sheet_name=${encodeURIComponent(sheetName)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data
}

export const importFixedDeposits = async (file, sheetName) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const { data } = await client.post(`/import/fixed-deposits?sheet_name=${encodeURIComponent(sheetName)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data
}

export const importExpenses = async (file, sheetName) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const { data } = await client.post(`/import/expenses?sheet_name=${encodeURIComponent(sheetName)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data
}

export const importShareholders = async (file, sheetName) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const { data } = await client.post(`/import/shareholders?sheet_name=${encodeURIComponent(sheetName)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data
}