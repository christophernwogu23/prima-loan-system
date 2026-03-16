import { useState } from 'react'
import Layout from '../components/Layout'
import { previewImport, importSavings, importLoans, importFixedDeposits, importExpenses, importShareholders } from '../api/import'
import client from '../api/client'
import { Upload, FileSpreadsheet, CheckCircle, Loader2, Wallet, Users, Landmark, Receipt, UserCheck, Trash2, AlertTriangle, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ImportData() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState({})
  const [selectedSheets, setSelectedSheets] = useState({
    savings: '', loans: '', fixedDeposits: '', expenses: '', shareholders: ''
  })

  // Clear modal state
  const [clearModal, setClearModal] = useState(false)
  const [clearTarget, setClearTarget] = useState(null) // null = all, or specific type
  const [clearing, setClearing] = useState(false)
  const [clearResults, setClearResults] = useState(null)

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return
    setFile(selectedFile)
    setLoading(true)
    setPreview(null)
    setResults({})
    try {
      const data = await previewImport(selectedFile)
      setPreview(data)
      setSelectedSheets({
        savings: data.sheets.find(s => s.toLowerCase().includes('saving')) || '',
        loans: data.sheets.find(s => s.toLowerCase().includes('loan')) || '',
        fixedDeposits: data.sheets.find(s => s.toLowerCase().includes('fixed') || s.toLowerCase().includes('deposit')) || '',
        expenses: data.sheets.find(s => s.toLowerCase().includes('expense')) || '',
        shareholders: data.sheets.find(s => s.toLowerCase().includes('share')) || ''
      })
      toast.success('File loaded successfully')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to read file')
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (type) => {
    if (!file) return
    const sheetName = selectedSheets[type]
    if (!sheetName) return toast.error(`Please select a sheet for ${type}`)

    setImporting(true)
    setResults(prev => ({ ...prev, [type]: { loading: true } }))
    try {
      let result
      switch (type) {
        case 'savings': result = await importSavings(file, sheetName); break
        case 'loans': result = await importLoans(file, sheetName); break
        case 'fixedDeposits': result = await importFixedDeposits(file, sheetName); break
        case 'expenses': result = await importExpenses(file, sheetName); break
        case 'shareholders': result = await importShareholders(file, sheetName); break
      }
      setResults(prev => ({ ...prev, [type]: { ...result, loading: false } }))
      toast.success(`${type} imported successfully`)
    } catch (error) {
      setResults(prev => ({ ...prev, [type]: { success: false, error: error.response?.data?.detail || 'Import failed', loading: false } }))
      toast.error(error.response?.data?.detail || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleClear = async () => {
    setClearing(true)
    try {
      let res
      if (!clearTarget) {
        res = await client.delete('/import/clear/all')
        setClearResults(res.data.deleted)
        toast.success('All imported data cleared!')
      } else {
        const endpoints = {
          loans: '/import/clear/loans',
          customers: '/import/clear/customers',
          fixedDeposits: '/import/clear/fixed-deposits',
          expenses: '/import/clear/expenses',
          shareholders: '/import/clear/shareholders'
        }
        res = await client.delete(endpoints[clearTarget])
        toast.success(res.data.message)
        setClearResults(null)
      }
      setClearModal(false)
      setResults({})
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to clear data')
    } finally {
      setClearing(false)
    }
  }

  const importTypes = [
    { key: 'savings', label: 'Customers & Savings', description: 'Import customer names and their savings balances', icon: Wallet, color: 'green' },
    { key: 'loans', label: 'Loans', description: 'Import loan officers, customers and loan balances with original dates', icon: Users, color: 'blue' },
    { key: 'fixedDeposits', label: 'Fixed Deposits', description: 'Import fixed deposit records', icon: Landmark, color: 'purple' },
    { key: 'expenses', label: 'Expenses', description: 'Import expense records with original dates', icon: Receipt, color: 'orange' },
    { key: 'shareholders', label: 'Shareholders', description: 'Import shareholder capital records', icon: UserCheck, color: 'indigo' }
  ]

  const clearTypes = [
    { key: null, label: 'Clear ALL Imported Data', description: 'Removes all loans, customers, savings, deposits, expenses and shareholders', danger: true },
    { key: 'loans', label: 'Clear Loans Only', description: 'Removes all IMP- prefixed loan applications' },
    { key: 'customers', label: 'Clear Customers & Savings', description: 'Removes imported customers (@prima.local) and their savings' },
    { key: 'fixedDeposits', label: 'Clear Fixed Deposits', description: 'Removes all fixed deposit records' },
    { key: 'expenses', label: 'Clear Expenses', description: 'Removes all imported expenses' },
    { key: 'shareholders', label: 'Clear Shareholders', description: 'Removes all shareholder records' },
  ]

  const getResultSummary = (type) => {
    const result = results[type]
    if (!result || result.loading) return null
    if (!result.success) return <span className="text-red-600 dark:text-red-400">{result.error}</span>
    switch (type) {
      case 'savings': return <span className="text-green-600 dark:text-green-400">✓ {result.created_customers} customers, {result.updated_savings} savings</span>
      case 'loans': return <span className="text-green-600 dark:text-green-400">✓ {result.created_officers} officers, {result.created_customers} customers, {result.created_loans} loans</span>
      case 'fixedDeposits': return <span className="text-green-600 dark:text-green-400">✓ {result.created_deposits} deposits</span>
      case 'expenses': return <span className="text-green-600 dark:text-green-400">✓ {result.created_expenses} expenses</span>
      case 'shareholders': return <span className="text-green-600 dark:text-green-400">✓ {result.created_shareholders} shareholders</span>
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Data</h1>
            <p className="text-gray-600 dark:text-gray-400">Upload Excel file to import customers, loans, and other data</p>
          </div>
          <button
            onClick={() => { setClearTarget(null); setClearModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Trash2 size={18} /> Clear Imported Data
          </button>
        </div>

        {/* Clear Results Banner */}
        {clearResults && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 flex justify-between items-start">
            <div>
              <p className="font-medium text-orange-800 dark:text-orange-300 mb-1">Data Cleared Successfully</p>
              <p className="text-sm text-orange-700 dark:text-orange-400">
                {clearResults.loans} loans · {clearResults.customers} customers · {clearResults.fixed_deposits} fixed deposits · {clearResults.expenses} expenses · {clearResults.shareholders} shareholders
              </p>
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">You can now re-upload your Excel file with the correct data.</p>
            </div>
            <button onClick={() => setClearResults(null)} className="text-orange-400 hover:text-orange-600"><X size={18} /></button>
          </div>
        )}

        {/* File Upload */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Step 1: Upload Excel File</h2>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="cursor-pointer">
              {loading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Reading file...</p>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center">
                  <FileSpreadsheet className="w-12 h-12 text-green-500 mb-4" />
                  <p className="text-gray-900 dark:text-white font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Click to change file</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-400 mt-1">Excel files only (.xlsx, .xls)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Import */}
        {preview && (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Step 2: Review & Import</h2>

            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300"><strong>Sheets found:</strong> {preview.sheets.join(', ')}</p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">Default password for imported users: <strong>Welcome123</strong></p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">📅 Dates will be read from your Excel DATE column if present — original dates are preserved.</p>
            </div>

            <div className="space-y-4">
              {importTypes.map((type) => {
                const Icon = type.icon
                const result = results[type.key]
                const isLoading = result?.loading
                const isSuccess = result?.success
                return (
                  <div key={type.key} className={`border rounded-lg p-4 transition-colors ${isSuccess ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{type.label}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{type.description}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-sm text-gray-600 dark:text-gray-400">Sheet:</label>
                            <select
                              value={selectedSheets[type.key]}
                              onChange={e => setSelectedSheets(prev => ({ ...prev, [type.key]: e.target.value }))}
                              className="border dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-white"
                              disabled={isLoading || isSuccess}
                            >
                              <option value="">-- Select --</option>
                              {preview.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {selectedSheets[type.key] && preview.data[selectedSheets[type.key]] && (
                              <span className="text-xs text-gray-400">{preview.data[selectedSheets[type.key]].row_count} rows</span>
                            )}
                          </div>
                          {getResultSummary(type.key) && <p className="text-sm mt-2">{getResultSummary(type.key)}</p>}
                          {result?.errors?.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-sm text-orange-600 dark:text-orange-400 cursor-pointer">{result.errors.length} warnings</summary>
                              <ul className="text-xs text-orange-600 dark:text-orange-400 mt-1 list-disc list-inside">
                                {result.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                                {result.errors.length > 5 && <li>...and {result.errors.length - 5} more</li>}
                              </ul>
                            </details>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleImport(type.key)}
                        disabled={!selectedSheets[type.key] || isLoading || isSuccess}
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${isSuccess ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'}`}
                      >
                        {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Importing...</> : isSuccess ? <><CheckCircle className="w-4 h-4" />Imported</> : 'Import'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Format Guide */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Expected Excel Format</h2>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Savings Sheet', cols: 'NAMES, BALANCES' },
              { label: 'Loans Sheet', cols: 'NAMES, BALANCES, CO (officer), TYPES, DATE (optional — original disbursement date)' },
              { label: 'Fixed Deposits Sheet', cols: 'NAME, AMOUNT, VALUE DATE, MATURITY DATE, INTEREST, DURATION' },
              { label: 'Expenses Sheet', cols: 'ITEM, AMOUNT, DATE (optional — original expense date)' },
              { label: 'Shareholders Sheet', cols: 'NAME/NAMES, CAPITAL/AMOUNT' },
            ].map(f => (
              <div key={f.label}>
                <span className="font-medium text-gray-900 dark:text-white">{f.label}: </span>
                <span className="text-gray-600 dark:text-gray-400">{f.cols}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {clearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold dark:text-white">Clear Imported Data</h3>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              Select what to clear. This is <strong>irreversible</strong> — make sure you have your Excel file ready to re-import.
            </p>

            <div className="space-y-2 mb-6">
              {clearTypes.map(ct => (
                <button
                  key={String(ct.key)}
                  onClick={() => setClearTarget(ct.key)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    clearTarget === ct.key
                      ? ct.danger
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <p className={`font-medium text-sm ${ct.danger ? 'text-red-700 dark:text-red-400' : 'dark:text-white'}`}>{ct.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ct.description}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setClearModal(false)} disabled={clearing}
                className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={handleClear} disabled={clearing || clearTarget === undefined}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {clearing ? <><Loader2 className="w-4 h-4 animate-spin" />Clearing...</> : <><Trash2 size={16} />Confirm Clear</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}