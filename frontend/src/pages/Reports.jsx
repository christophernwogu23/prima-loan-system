import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getReports } from '../api/stats'
import { getUsers } from '../api/users'
import { exportReport } from '../api/reports'
import api from '../api/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer
} from 'recharts'
import { BarChart3, Users as UsersIcon, DollarSign, TrendingUp, TrendingDown, Download, FileSpreadsheet } from 'lucide-react'

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4']

export default function Reports() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('overview')
  const [reports, setReports] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [exporting, setExporting] = useState(false)

  // Loan Officer Filter
  const [selectedOfficer, setSelectedOfficer] = useState(null)
  const [loanOfficers, setLoanOfficers] = useState([])

  // Officers Performance data
  const [performanceData, setPerformanceData] = useState([])
  
  // Revenue vs Expenses data
  const [revenueExpensesData, setRevenueExpensesData] = useState(null)
  
  // Date filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Export report type selector
  const [selectedReportType, setSelectedReportType] = useState('balance_sheet')
  const [showExportModal, setShowExportModal] = useState(false)

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

  const generateMonthOptions = () => {
    const months = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = date.toISOString().slice(0, 7)
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      months.push({ value, label })
    }
    return months
  }

  const monthOptions = generateMonthOptions()

  useEffect(() => {
    if (['manager', 'ceo', 'admin'].includes(user?.role)) {
      getUsers('loan_officer').then(setLoanOfficers).catch(console.error)
    }
  }, [user])

  useEffect(() => {
    if (activeTab === 'overview') {
      loadReports()
    } else if (activeTab === 'officers') {
      fetchOfficersPerformance()
    } else if (activeTab === 'revenue') {
      fetchRevenueExpenses()
    }
  }, [activeTab, activeFilter, selectedMonth, selectedOfficer, startDate, endDate])
  
  const loadReports = async () => {
    setLoading(true)
    try {
      let data
      if (activeFilter === 'custom_month' && selectedMonth) {
        data = await getReports(activeFilter, selectedMonth, selectedOfficer)
      } else {
        data = await getReports(activeFilter, null, selectedOfficer)
      }
      setReports(data)
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOfficersPerformance = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      if (selectedOfficer) params.append('officer_id', selectedOfficer)
      
      const response = await api.get(`/reports/loan-officers-performance?${params}`)
      setPerformanceData(response.data)
    } catch (error) {
      console.error('Error fetching performance:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRevenueExpenses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      if (selectedOfficer) params.append('officer_id', selectedOfficer)
      
      const response = await api.get(`/reports/revenue-vs-expenses?${params}`)
      setRevenueExpensesData(response.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (filter) => {
    setActiveFilter(filter)
    if (filter !== 'custom_month') {
      setSelectedMonth('')
    } else if (!selectedMonth) {
      setSelectedMonth(new Date().toISOString().slice(0, 7))
    }
  }

  const handleExportCustomReport = async () => {
    setExporting(true)
    try {
      const blob = await exportReport(selectedReportType, startDate, endDate)
      
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      
      const reportName = reportTypes.find(r => r.value === selectedReportType)?.label.replace(/ /g, '_') || selectedReportType
      a.download = `PRIMA_${reportName}_${new Date().toISOString().split('T')[0]}.xlsx`
      
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
      
      toast.success('Report exported successfully!')
      setShowExportModal(false)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export report. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleApplyFilter = () => {
    if (activeTab === 'officers') {
      fetchOfficersPerformance()
    } else if (activeTab === 'revenue') {
      fetchRevenueExpenses()
    }
  }

  const handleClearFilter = () => {
    setStartDate('')
    setEndDate('')
    setTimeout(() => {
      if (activeTab === 'officers') {
        fetchOfficersPerformance()
      } else if (activeTab === 'revenue') {
        fetchRevenueExpenses()
      }
    }, 100)
  }

  const getFilterLabel = () => {
    if (reports?.filter_label) {
      return reports.filter_label
    }
    switch(activeFilter) {
      case 'day': return 'Last 24 Hours'
      case 'week': return 'Last 7 Days'
      case 'month': return 'Last 30 Days'
      case 'year': return 'Last Year'
      case 'custom_month': return selectedMonth ? monthOptions.find(m => m.value === selectedMonth)?.label : 'Select Month'
      default: return 'Last 30 Days'
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatPercent = (value) => {
    return `${value.toFixed(1)}%`
  }

  if (loading && !reports && activeTab === 'overview') {
    return (
      <Layout>
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600 dark:text-gray-400">Loading reports...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold dark:text-white">Reports & Analytics</h2>
        
        {/* Export Custom Report Button */}
        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <FileSpreadsheet size={20} />
          Export Custom Report
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold dark:text-white">Export Custom Report</h3>
                <button 
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Report Type Selection */}
              <div>
                <label className="block text-sm font-medium mb-3 dark:text-gray-300">
                  Select Report Type
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {reportTypes.map((report) => (
                    <button
                      key={report.value}
                      onClick={() => setSelectedReportType(report.value)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        selectedReportType === report.value
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <FileSpreadsheet 
                          className={selectedReportType === report.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'} 
                          size={20} 
                        />
                        <div className="flex-1">
                          <div className={`font-medium ${selectedReportType === report.value ? 'text-blue-600 dark:text-blue-400' : 'dark:text-white'}`}>
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

              {/* Date Range Filter */}
              <div className="border-t dark:border-gray-700 pt-6">
                <label className="block text-sm font-medium mb-3 dark:text-gray-300">
                  Date Range (Optional)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate('')
                      setEndDate('')
                    }}
                    className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Clear dates
                  </button>
                )}
              </div>

              {/* Export Button */}
              <div className="border-t dark:border-gray-700 pt-6">
                <button
                  onClick={handleExportCustomReport}
                  disabled={exporting}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {exporting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating Report...
                    </>
                  ) : (
                    <>
                      <Download size={20} />
                      Export to Excel
                    </>
                  )}
                </button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Note:</strong> Reports will be downloaded as Excel files (.xlsx). 
                  {startDate || endDate 
                    ? ' Filtered by your selected date range.' 
                    : ' No date filter applied - showing all time data.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <BarChart3 size={18} />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('officers')}
          className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'officers'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <UsersIcon size={18} />
          Officers Performance
        </button>
        <button
          onClick={() => setActiveTab('revenue')}
          className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'revenue'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <DollarSign size={18} />
          Revenue vs Expenses
        </button>
      </div>

      {/* Overview Tab Filters */}
      {activeTab === 'overview' && (
        <div className="flex gap-3 mb-6 flex-wrap">
          {['manager', 'ceo', 'admin'].includes(user?.role) && (
            <select
              value={selectedOfficer || ''}
              onChange={(e) => setSelectedOfficer(e.target.value ? parseInt(e.target.value) : null)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Officers</option>
              {loanOfficers.map(officer => (
                <option key={officer.id} value={officer.id}>
                  {officer.first_name} {officer.last_name}
                </option>
              ))}
            </select>
          )}

          <select
            value={activeFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
            <option value="custom_month">Specific Month</option>
          </select>

          {activeFilter === 'custom_month' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Date Filter for Officers & Revenue tabs */}
      {(activeTab === 'officers' || activeTab === 'revenue') && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 mb-6">
          <div className="flex gap-4 items-end flex-wrap">
            {['manager', 'ceo', 'admin'].includes(user?.role) && (
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium mb-2 dark:text-gray-300">Loan Officer</label>
                <select
                  value={selectedOfficer || ''}
                  onChange={(e) => setSelectedOfficer(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-2 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                >
                  <option value="">All Officers</option>
                  {loanOfficers.map(officer => (
                    <option key={officer.id} value={officer.id}>
                      {officer.first_name} {officer.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              />
            </div>
            <button
              onClick={handleApplyFilter}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Apply Filter
            </button>
            <button
              onClick={handleClearFilter}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Keep all your existing tab content below - I'll just show the structure */}
      {loading ? (
        <p className="dark:text-white">Loading...</p>
      ) : (
        <>
          {/* Your existing OVERVIEW, OFFICERS PERFORMANCE, and REVENUE VS EXPENSES tabs */}
          {/* Don't change anything - just keep them as is */}
        </>
      )}
    </Layout>
  )
}