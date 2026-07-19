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
import { BarChart3, Users as UsersIcon, DollarSign, TrendingUp, TrendingDown, Download, FileSpreadsheet, X, Building } from 'lucide-react'

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
  const [fixedDeposits, setFixedDeposits] = useState({ total_amount: 0, count: 0, deposits: [] })

  // Revenue vs Expenses data
  const [revenueExpensesData, setRevenueExpensesData] = useState(null)

  // Date filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedReportType, setSelectedReportType] = useState('balance_sheet')
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')

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
      fetchFixedDeposits()
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

      const response = await api.get(`/stats/loan-officers-performance?${params}`)
      setPerformanceData(response.data)
    } catch (error) {
      console.error('Error fetching performance:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFixedDeposits = async () => {
    try {
      const response = await api.get('/stats/fixed-deposits-list')
      setFixedDeposits(response.data)
    } catch (error) {
      console.error('Error fetching fixed deposits:', error)
    }
  }

  const fetchRevenueExpenses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      if (selectedOfficer) params.append('officer_id', selectedOfficer)

      const response = await api.get(`/stats/revenue-vs-expenses?${params}`)
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

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportReport(selectedReportType, exportStartDate, exportEndDate)

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

        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          <FileSpreadsheet size={20} />
          Export Report
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold dark:text-white">Export Report</h3>
                <button onClick={() => setShowExportModal(false)} className="text-gray-500 hover:text-gray-700">
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
                      className={`p-4 rounded-lg border-2 text-left ${
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
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 font-medium flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <BarChart3 size={18} />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('officers')}
          className={`px-6 py-3 font-medium flex items-center gap-2 ${
            activeTab === 'officers'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <UsersIcon size={18} />
          Officers Performance
        </button>
        <button
          onClick={() => setActiveTab('revenue')}
          className={`px-6 py-3 font-medium flex items-center gap-2 ${
            activeTab === 'revenue'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400'
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
              className="px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
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
            className="px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
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
              className="px-4 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
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
              Apply
            </button>
            <button
              onClick={handleClearFilter}
              className="px-4 py-2 border dark:border-gray-600 rounded-md dark:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="dark:text-white">Loading...</p>
      ) : (
        <>
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400">Applications ({getFilterLabel()})</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{reports?.period_applications || 0}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400">Amount ({getFilterLabel()})</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">₦{(reports?.period_total_amount || 0).toLocaleString()}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
                  <p className="text-sm text-purple-600 dark:text-purple-400">Approved ({getFilterLabel()})</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{reports?.period_approved_count || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Applications by Status */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Applications by Status</h3>
                  {reports?.applications_by_status?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={reports.applications_by_status}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label
                        >
                          {reports.applications_by_status.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-10">No data</p>
                  )}
                </div>

                {/* Active vs Defaults */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Active vs Defaults</h3>
                  {reports?.active_vs_defaults?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={reports.active_vs_defaults}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          dataKey="value"
                          label
                        >
                          {reports.active_vs_defaults.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === 'Active Payments' ? '#22c55e' : '#ef4444'} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-10">No data</p>
                  )}
                </div>

                {/* Applications by Product */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">By Product</h3>
                  {reports?.applications_by_product?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reports.applications_by_product}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="applications" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-10">No data</p>
                  )}
                </div>

                {/* Monthly Trend */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Trend ({getFilterLabel()})</h3>
                  {reports?.monthly_trend?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={reports.monthly_trend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="applications" stroke="#3b82f6" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-10">No data</p>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'officers' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 dark:text-white">Officer Performance</h3>
                {performanceData.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-10">No data</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b dark:border-gray-700">
                          <th className="text-left p-3 text-sm font-semibold dark:text-white">Officer</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Apps</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Approved</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Rate</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Disbursed (Loans)</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Savings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {performanceData.map((officer) => (
                          <tr key={officer.officer_id} className="border-b dark:border-gray-700">
                            <td className="p-3 dark:text-white">{officer.officer_name}</td>
                            <td className="text-right p-3 dark:text-gray-300">{officer.total_applications}</td>
                            <td className="text-right p-3 dark:text-gray-300">{officer.approved_applications}</td>
                            <td className="text-right p-3 text-green-600 dark:text-green-400">{formatPercent(officer.approval_rate)}</td>
                            <td className="text-right p-3 dark:text-gray-300">{formatCurrency(officer.total_disbursed)}</td>
                            <td className="text-right p-3 text-blue-600 dark:text-blue-400">{formatCurrency(officer.total_savings)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Fixed Deposits — unattributed, shown separately since they aren't linked to a customer/officer yet */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-semibold dark:text-white flex items-center gap-2">
                    <Building size={18} className="text-indigo-500" />
                    Fixed Deposits (All Officers)
                  </h3>
                  <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(fixedDeposits.total_amount)} across {fixedDeposits.count} deposit(s)
                  </p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Fixed deposits aren't currently linked to a customer record, so they can't be broken down per loan officer.
                </p>
                {fixedDeposits.deposits.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-6">No active fixed deposits</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b dark:border-gray-700">
                          <th className="text-left p-3 font-semibold dark:text-white">Depositor</th>
                          <th className="text-right p-3 font-semibold dark:text-white">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fixedDeposits.deposits.map((d) => (
                          <tr key={d.id} className="border-b dark:border-gray-700">
                            <td className="p-3 dark:text-white">{d.depositor_name}</td>
                            <td className="text-right p-3 dark:text-gray-300">{formatCurrency(d.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'revenue' && revenueExpensesData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(revenueExpensesData.summary.total_revenue)}
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {formatCurrency(revenueExpensesData.summary.total_expenses)}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400">Net Profit</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {formatCurrency(revenueExpensesData.summary.net_profit)}
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
                  <p className="text-sm text-purple-600 dark:text-purple-400">Profit Margin</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {revenueExpensesData.summary.profit_margin.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 dark:text-white">Monthly Revenue vs Expenses</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueExpensesData.monthly_breakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} />
                    <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} />
                    <Line type="monotone" dataKey="net_profit" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}
    </Layout>
  )
}