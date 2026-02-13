import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getReports } from '../api/stats'
import { exportReport } from '../api/reports'
import toast from 'react-hot-toast'
import { Download, FileSpreadsheet } from 'lucide-react'

export default function Reports() {
  const [reports, setReports] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedReportType, setSelectedReportType] = useState('balance_sheet')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const reportTypes = [
    { value: 'balance_sheet', label: 'Balance Sheet', description: 'Assets, Liabilities, Equity' },
    { value: 'profit_loss', label: 'Profit & Loss', description: 'Revenue vs Expenses' },
    { value: 'interest', label: 'Interest Report', description: 'Interest income from loans' },
    { value: 'upfront', label: 'Upfront Charges', description: 'Admin fees, insurance, forms' },
    { value: 'loan_disbursement', label: 'Loan Disbursements', description: 'All disbursed loans' },
    { value: 'fixed_deposit', label: 'Fixed Deposits', description: 'Fixed deposit accounts' },
    { value: 'fixed_assets', label: 'Fixed Assets', description: 'Property, equipment' },
    { value: 'savings', label: 'Savings Accounts', description: 'Customer savings' },
    { value: 'shares', label: 'Shares Schedule', description: 'Shareholder information' },
  ]

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    setLoading(true)
    try {
      const data = await getReports('month')
      setReports(data)
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportReport(selectedReportType, startDate, endDate)
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const reportName = reportTypes.find(r => r.value === selectedReportType)?.label.replace(/ /g, '_')
      a.download = `PRIMA_${reportName}_${new Date().toISOString().split('T')[0]}.xlsx`
      
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Report exported!')
      setShowExportModal(false)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold dark:text-white">Reports & Analytics</h2>
        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          <FileSpreadsheet size={20} />
          Export Report
        </button>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold dark:text-white">Export Report</h3>
                <button 
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-3 dark:text-gray-300">Select Report Type</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {reportTypes.map((report) => (
                    <button
                      key={report.value}
                      onClick={() => setSelectedReportType(report.value)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        selectedReportType === report.value
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <FileSpreadsheet 
                          className={selectedReportType === report.value ? 'text-blue-600' : 'text-gray-400'} 
                          size={20} 
                        />
                        <div>
                          <div className={`font-medium ${selectedReportType === report.value ? 'text-blue-600' : 'dark:text-white'}`}>
                            {report.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {report.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t dark:border-gray-700 pt-6">
                <label className="block text-sm font-medium mb-3 dark:text-gray-300">Date Range (Optional)</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t dark:border-gray-700 pt-6">
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  {exporting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download size={20} />
                      Export to Excel
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <p className="text-gray-600 dark:text-gray-400">Loading reports...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">Analytics Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">Total Applications</p>
              <p className="text-2xl font-bold dark:text-white">{reports?.total_applications || 0}</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">Period Applications</p>
              <p className="text-2xl font-bold dark:text-white">{reports?.period_applications || 0}</p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-purple-600 dark:text-purple-400">Period Amount</p>
              <p className="text-2xl font-bold dark:text-white">₦{(reports?.period_total_amount || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}