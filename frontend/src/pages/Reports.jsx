import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getReports } from '../api/stats'
import api from '../api/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer
} from 'recharts'
import { BarChart3, Users as UsersIcon, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4']

export default function Reports() {
  const [activeTab, setActiveTab] = useState('overview')
  const [reports, setReports] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [exporting, setExporting] = useState(false)

  // Officers Performance data
  const [performanceData, setPerformanceData] = useState([])
  
  // Revenue vs Expenses data
  const [revenueExpensesData, setRevenueExpensesData] = useState(null)
  
  // Date filters for new tabs
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Generate list of months (last 12 months)
  const generateMonthOptions = () => {
    const months = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = date.toISOString().slice(0, 7) // YYYY-MM
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      months.push({ value, label })
    }
    return months
  }

  const monthOptions = generateMonthOptions()

  useEffect(() => {
    if (activeTab === 'overview') {
      loadReports()
    } else if (activeTab === 'officers') {
      fetchOfficersPerformance()
    } else if (activeTab === 'revenue') {
      fetchRevenueExpenses()
    }
  }, [activeTab, activeFilter, selectedMonth, startDate, endDate])
  
  const loadReports = async () => {
    setLoading(true)
    try {
      let data
      if (activeFilter === 'custom_month' && selectedMonth) {
        data = await getReports(activeFilter, selectedMonth)
      } else {
        data = await getReports(activeFilter)
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

  const handleExport = async () => {
    setExporting(true)
    try {
      const token = localStorage.getItem('token')
      let url = `/api/v1/stats/reports/export?filter=${activeFilter}`
      if (activeFilter === 'custom_month' && selectedMonth) {
        url += `&month=${selectedMonth}`
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `PRIMA_Analytics_Report_${activeFilter}_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to export report:', error)
      alert('Failed to export report. Please try again.')
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

  if (loading) {
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
        
        {/* Show filter controls only on Overview tab */}
        {activeTab === 'overview' && (
          <div className="flex gap-3">
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

            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export to Excel
                </>
              )}
            </button>
          </div>
        )}
      </div>

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

      {/* Date Filter for Officers & Revenue tabs */}
      {(activeTab === 'officers' || activeTab === 'revenue') && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 mb-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex-1">
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

      {/* Tab Content */}
      {loading ? (
        <p className="dark:text-white">Loading...</p>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              {/* Period Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Applications ({getFilterLabel()})</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{reports?.period_applications || 0}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Amount Requested ({getFilterLabel()})</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">₦{(reports?.period_total_amount || 0).toLocaleString()}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Approved ({getFilterLabel()})</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{reports?.period_approved_count || 0}</p>
                </div>
              </div>
            
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Applications by Status - Donut Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Applications by Status (All Time)</h3>
                  {reports?.applications_by_status?.length > 0 ? (
                    <div className="flex items-center gap-8">
                      <div className="relative flex-1">
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart margin={{ top: 10, right: 12, bottom: 10, left: 12 }}>
                            <Pie
                              data={reports.applications_by_status}
                              cx="50%"
                              cy="50%"
                              innerRadius={85}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                              paddingAngle={5}
                            >
                              {reports.applications_by_status.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                          <div className="text-4xl font-bold text-gray-800 dark:text-white">{reports.total_applications}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Apps</div>
                        </div>
                      </div>

                      <div className="w-48 space-y-3">
                        {reports.applications_by_status.map((item, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-sm flex-shrink-0" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                                {item.name.replace('_', ' ')}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-gray-800 dark:text-white">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-10">No data available</p>
                  )}
                </div>

                {/* Active Payments vs Defaults */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Active Payments vs Defaults</h3>
                  {reports?.active_vs_defaults?.length > 0 ? (
                    <div className="flex items-center gap-8">
                      <div className="relative flex-1">
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                            <Pie
                              data={reports.active_vs_defaults}
                              cx="50%"
                              cy="50%"
                              innerRadius={85}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                              paddingAngle={5}
                            >
                              {reports.active_vs_defaults.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.name === 'Active Payments' ? '#22c55e' : '#ef4444'} 
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                          <div className="text-4xl font-bold text-gray-800 dark:text-white">
                            {reports.active_vs_defaults.reduce((sum, item) => sum + item.value, 0)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Loans</div>
                        </div>
                      </div>

                      <div className="w-48 space-y-3">
                        {reports.active_vs_defaults.map((item, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-sm flex-shrink-0" 
                                style={{ backgroundColor: item.name === 'Active Payments' ? '#22c55e' : '#ef4444' }}
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{item.name}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-800 dark:text-white">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-10">No data available</p>
                  )}
                </div>

                {/* Applications by Product */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Applications by Product (All Time)</h3>
                  {reports?.applications_by_product?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reports.applications_by_product}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar 
                          dataKey="applications" 
                          fill="#3b82f6" 
                          name="Applications" 
                          barSize={15}
                          radius={[8, 8, 8, 8]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-10">No data available</p>
                  )}
                </div>

                {/* Amount by Product */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Loan Amount by Product (All Time)</h3>
                  {reports?.applications_by_product?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reports.applications_by_product}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value) => `₦${value.toLocaleString()}`} />
                        <Legend />
                        <Bar 
                          dataKey="amount" 
                          fill="#22c55e" 
                          name="Amount (₦)" 
                          barSize={15}
                          radius={[8, 8, 8, 8]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-10">No data available</p>
                  )}
                </div>

                {/* Monthly Trend */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 lg:col-span-2">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Application Trend ({getFilterLabel()})</h3>
                  {reports?.monthly_trend?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={reports.monthly_trend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="applications" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          name="Applications"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-10">No data for selected period</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* OFFICERS PERFORMANCE TAB */}
          {activeTab === 'officers' && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Officers</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{performanceData.length}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Applications</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {performanceData.reduce((sum, o) => sum + o.total_applications, 0)}
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Total Disbursed</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {formatCurrency(performanceData.reduce((sum, o) => sum + o.total_disbursed, 0))}
                  </p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 rounded-lg">
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Avg Approval Rate</p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {performanceData.length > 0
                      ? formatPercent(performanceData.reduce((sum, o) => sum + o.approval_rate, 0) / performanceData.length)
                      : '0%'}
                  </p>
                </div>
              </div>

              {/* Performance Table */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 dark:text-white">Officer Performance Metrics</h3>
                {performanceData.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-10">No data available</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b dark:border-gray-700">
                          <th className="text-left p-3 text-sm font-semibold dark:text-white">Officer Name</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Total Apps</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Approved</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Approval Rate</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Disbursed</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Total Disbursed</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Collected</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Outstanding</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Defaults</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Default Rate</th>
                          <th className="text-right p-3 text-sm font-semibold dark:text-white">Avg Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {performanceData.map((officer) => (
                          <tr key={officer.officer_id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="p-3 font-medium dark:text-white">{officer.officer_name}</td>
                            <td className="text-right p-3 dark:text-gray-300">{officer.total_applications}</td>
                            <td className="text-right p-3 dark:text-gray-300">{officer.approved_applications}</td>
                            <td className="text-right p-3">
                              <span className={`font-semibold ${officer.approval_rate >= 70 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                {formatPercent(officer.approval_rate)}
                              </span>
                            </td>
                            <td className="text-right p-3 dark:text-gray-300">{officer.disbursed_applications}</td>
                            <td className="text-right p-3 dark:text-gray-300">{formatCurrency(officer.total_disbursed)}</td>
                            <td className="text-right p-3 text-green-600 dark:text-green-400 font-semibold">{formatCurrency(officer.total_collected)}</td>
                            <td className="text-right p-3 text-orange-600 dark:text-orange-400 font-semibold">{formatCurrency(officer.total_outstanding)}</td>
                            <td className="text-right p-3 dark:text-gray-300">{officer.defaults_count}</td>
                            <td className="text-right p-3">
                              <span className={`font-semibold ${officer.default_rate >= 10 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {formatPercent(officer.default_rate)}
                              </span>
                            </td>
                            <td className="text-right p-3 dark:text-gray-300">{officer.avg_processing_days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* REVENUE VS EXPENSES TAB */}
          {activeTab === 'revenue' && revenueExpensesData && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {formatCurrency(revenueExpensesData.summary.total_revenue)}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium">Total Expenses</p>
                      <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                        {formatCurrency(revenueExpensesData.summary.total_expenses)}
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-600 dark:text-red-400" />
                  </div>
                </div>

                <div className={`${revenueExpensesData.summary.net_profit >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'} border p-4 rounded-lg`}>
                  <p className={`text-sm font-medium ${revenueExpensesData.summary.net_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    Net Profit
                  </p>
                  <p className={`text-2xl font-bold ${revenueExpensesData.summary.net_profit >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {formatCurrency(revenueExpensesData.summary.net_profit)}
                  </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Profit Margin</p>
                  <p className={`text-2xl font-bold ${revenueExpensesData.summary.profit_margin >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>
                    {revenueExpensesData.summary.profit_margin.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Trend */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 lg:col-span-2">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Monthly Revenue vs Expenses</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueExpensesData.monthly_breakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} name="Revenue" />
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
                      <Line type="monotone" dataKey="net_profit" stroke="#3b82f6" strokeWidth={2} name="Net Profit" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Bar Chart Comparison */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 lg:col-span-2">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Monthly Comparison</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueExpensesData.monthly_breakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="revenue" fill="#22c55e" name="Revenue" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Expense Categories */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Expense Categories</h3>
                  {revenueExpensesData.expense_categories.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={revenueExpensesData.expense_categories}
                          dataKey="amount"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(entry) => entry.category}
                        >
                          {revenueExpensesData.expense_categories.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-10">No expense data</p>
                  )}
                </div>

                {/* Revenue Sources */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Revenue Sources</h3>
                  <div className="space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">Loan Repayments</p>
                      <p className="text-xl font-bold text-green-700 dark:text-green-300">
                        {formatCurrency(revenueExpensesData.revenue_sources.loan_repayments)}
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                      <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Estimated Interest Income</p>
                      <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                        {formatCurrency(revenueExpensesData.revenue_sources.interest_income)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Layout>
  )
}