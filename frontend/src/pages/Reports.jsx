import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getReports } from '../api/stats'
import { getUsers } from '../api/users'
import api from '../api/api'
import { useAuthStore } from '../store/authStore'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer
} from 'recharts'
import { BarChart3, Users as UsersIcon, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'

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

  // Load loan officers for filter dropdown (managers/CEO/admin only)
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

  const handleExport = async () => {
    setExporting(true)
    try {
      const token = localStorage.getItem('token')
      let url = `/api/v1/stats/reports/export?filter=${activeFilter}`
      if (activeFilter === 'custom_month' && selectedMonth) {
        url += `&month=${selectedMonth}`
      }
      if (selectedOfficer) {
        url += `&officer_id=${selectedOfficer}`
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
        
        {/* Show filter controls only on Overview tab */}
        {activeTab === 'overview' && (
          <div className="flex gap-3 flex-wrap">
            {/* Loan Officer Filter - Only for managers/CEO/admin */}
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
          <div className="flex gap-4 items-end flex-wrap">
            {/* Loan Officer Filter for Officers and Revenue tabs */}
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

      {/* Rest of the component stays the same... */}
      {/* Tab Content */}
      {loading ? (
        <p className="dark:text-white">Loading...</p>
      ) : (
        <>
          {/* Keep all your existing tab content (OVERVIEW, OFFICERS PERFORMANCE, REVENUE VS EXPENSES) exactly as is */}
          {/* I'm not including it here to keep this response concise, but don't change anything below this point */}
        </>
      )}
    </Layout>
  )
}