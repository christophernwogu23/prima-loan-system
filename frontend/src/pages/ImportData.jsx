import { useState } from 'react'
import Layout from '../components/Layout'
import { previewImport, importSavings, importLoans, importFixedDeposits, importExpenses, importShareholders } from '../api/import'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Users, Wallet, Landmark, Receipt, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'


export default function ImportData() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState({})
  const [selectedSheets, setSelectedSheets] = useState({
    savings: '',
    loans: '',
    fixedDeposits: '',
    expenses: '',
    shareholders: ''
  })

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
      
      // Auto-detect sheets
      const sheets = data.sheets.map(s => s.toLowerCase())
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
    if (!sheetName) {
      toast.error(`Please select a sheet for ${type}`)
      return
    }

    setImporting(true)
    setResults(prev => ({ ...prev, [type]: { loading: true } }))

    try {
      let result
      switch (type) {
        case 'savings':
          result = await importSavings(file, sheetName)
          break
        case 'loans':
          result = await importLoans(file, sheetName)
          break
        case 'fixedDeposits':
          result = await importFixedDeposits(file, sheetName)
          break
        case 'expenses':
          result = await importExpenses(file, sheetName)
          break
        case 'shareholders':
          result = await importShareholders(file, sheetName)
          break
      }
      
      setResults(prev => ({ ...prev, [type]: { ...result, loading: false } }))
      toast.success(`${type} imported successfully`)
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        [type]: { 
          success: false, 
          error: error.response?.data?.detail || 'Import failed',
          loading: false 
        } 
      }))
      toast.error(error.response?.data?.detail || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const importTypes = [
    {
      key: 'savings',
      label: 'Customers & Savings',
      description: 'Import customer names and their savings balances',
      icon: Wallet,
      color: 'green'
    },
    {
      key: 'loans',
      label: 'Loans',
      description: 'Import loan officers, customers, and loan balances',
      icon: Users,
      color: 'blue'
    },
    {
      key: 'fixedDeposits',
      label: 'Fixed Deposits',
      description: 'Import fixed deposit records',
      icon: Landmark,
      color: 'purple'
    },
    {
      key: 'expenses',
      label: 'Expenses',
      description: 'Import expense records',
      icon: Receipt,
      color: 'orange'
    },
    {
      key: 'shareholders',
      label: 'Shareholders',
      description: 'Import shareholder capital records',
      icon: UserCheck,
      color: 'indigo'
    }
  ]

  const getResultSummary = (type) => {
    const result = results[type]
    if (!result || result.loading) return null

    if (!result.success) {
      return <span className="text-red-600 dark:text-red-400">{result.error}</span>
    }

    switch (type) {
      case 'savings':
        return (
          <span className="text-green-600 dark:text-green-400">
            ✓ {result.created_customers} customers, {result.updated_savings} savings records
          </span>
        )
      case 'loans':
        return (
          <span className="text-green-600 dark:text-green-400">
            ✓ {result.created_officers} officers, {result.created_customers} customers, {result.created_loans} loans
          </span>
        )
      case 'fixedDeposits':
        return (
          <span className="text-green-600 dark:text-green-400">
            ✓ {result.created_deposits} deposits imported
          </span>
        )
      case 'expenses':
        return (
          <span className="text-green-600 dark:text-green-400">
            ✓ {result.created_expenses} expenses imported
          </span>
        )
      case 'shareholders':
        return (
          <span className="text-green-600 dark:text-green-400">
            ✓ {result.created_shareholders} shareholders imported
          </span>
        )
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Data</h1>
          <p className="text-gray-600 dark:text-gray-400">Upload Excel file to import customers, loans, and other data</p>
        </div>

        {/* File Upload */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Step 1: Upload Excel File</h2>
          
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {loading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-blue-500 dark:text-blue-400 animate-spin mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Reading file...</p>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center">
                  <FileSpreadsheet className="w-12 h-12 text-green-500 dark:text-green-400 mb-4" />
                  <p className="text-gray-900 dark:text-white font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Click to change file</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Excel files only (.xlsx, .xls)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Step 2: Review & Import</h2>
            
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Sheets found:</strong> {preview.sheets.join(', ')}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Default password for imported users: <strong>Welcome123</strong>
              </p>
            </div>

            <div className="space-y-4">
              {importTypes.map((type) => {
                const Icon = type.icon
                const result = results[type.key]
                const isLoading = result?.loading
                const isSuccess = result?.success
                
                return (
                  <div 
                    key={type.key} 
                    className={`border rounded-lg p-4 transition-colors ${
                      isSuccess 
                        ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' 
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-${type.color}-100 dark:bg-${type.color}-900/30`}>
                          <Icon className={`w-5 h-5 text-${type.color}-600 dark:text-${type.color}-400`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{type.label}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{type.description}</p>
                          
                          <div className="mt-2">
                            <label className="text-sm text-gray-600 dark:text-gray-400">Select sheet:</label>
                            <select
                              value={selectedSheets[type.key]}
                              onChange={(e) => setSelectedSheets(prev => ({ ...prev, [type.key]: e.target.value }))}
                              className="ml-2 border dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-white"
                              disabled={isLoading || isSuccess}
                            >
                              <option value="">-- Select --</option>
                              {preview.sheets.map(sheet => (
                                <option key={sheet} value={sheet}>{sheet}</option>
                              ))}
                            </select>
                          </div>

                          {selectedSheets[type.key] && preview.data[selectedSheets[type.key]] && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {preview.data[selectedSheets[type.key]].row_count} rows found
                            </p>
                          )}

                          {getResultSummary(type.key) && (
                            <p className="text-sm mt-2">{getResultSummary(type.key)}</p>
                          )}

                          {result?.errors?.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-sm text-orange-600 dark:text-orange-400 cursor-pointer">
                                {result.errors.length} warnings
                              </summary>
                              <ul className="text-xs text-orange-600 dark:text-orange-400 mt-1 list-disc list-inside">
                                {result.errors.slice(0, 5).map((err, i) => (
                                  <li key={i}>{err}</li>
                                ))}
                                {result.errors.length > 5 && (
                                  <li>...and {result.errors.length - 5} more</li>
                                )}
                              </ul>
                            </details>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleImport(type.key)}
                        disabled={!selectedSheets[type.key] || isLoading || isSuccess}
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                          isSuccess 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                        }`}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Importing...
                          </>
                        ) : isSuccess ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Imported
                          </>
                        ) : (
                          'Import'
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Expected Excel Format</h2>
          
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Savings Sheet</h3>
              <p className="text-gray-600 dark:text-gray-400">Columns: NAMES, BALANCES</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Loans Sheet</h3>
              <p className="text-gray-600 dark:text-gray-400">Columns: NAMES, BALANCES, CO (officer), TYPES (SME/PERSONAL)</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Fixed Deposits Sheet</h3>
              <p className="text-gray-600 dark:text-gray-400">Columns: NAME, AMOUNT, VALUE DATE, MATURITY DATE, INTEREST, DURATION</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Expenses Sheet</h3>
              <p className="text-gray-600 dark:text-gray-400">Columns: ITEM, AMOUNT</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}