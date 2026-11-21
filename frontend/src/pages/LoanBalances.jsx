import { Fragment, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuthStore } from '../../store/authStore'
import {
  ArrowLeft, Search, RefreshCw, Download, ChevronDown, ChevronRight,
  Wallet, Users, TrendingUp
} from 'lucide-react'
import client from '../../api/client'
import toast from 'react-hot-toast'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount || 0)

const formatDate = (dateStr) => {
  if (!dateStr) return '\u2014'
  return new Date(dateStr).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

const todayStr = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Still owing' },
  { value: 'paid', label: 'Fully paid' },
  { value: 'all', label: 'All loans' },
]

export default function LoanBalances() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [data, setData] = useState({ summary: null, customers: [] })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [expanded, setExpanded] = useState({})
  const [exporting, setExporting] = useState(false)
  const requestId = useRef(0)

  const canExport = ['admin', 'ceo', 'manager'].includes(user?.role)

  const loadData = async () => {
    const id = ++requestId.current
    setLoading(true)
    try {
      const { data } = await client.get('/reports/loan-balances', {
        params: { search: search.trim() || undefined, status },
      })
      // Ignore answers that arrive after a newer search has already been sent
      if (id === requestId.current) setData(data)
    } catch (err) {
      if (id === requestId.current) {
        const detail = err.response?.data?.detail
        toast.error(typeof detail === 'string' ? detail : 'Could not load loan balances')
      }
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }

  // Reload when the search or filter changes (waits briefly while the user is typing)
  useEffect(() => {
    const timer = setTimeout(loadData, 300)
    return () => clearTimeout(timer)
  }, [search, status])

  const toggle = (customerId) =>
    setExpanded((prev) => ({ ...prev, [customerId]: !prev[customerId] }))

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await client.get('/reports/loan-balances/export', {
        params: { search: search.trim() || undefined, status },
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `PRIMA_Loan_Balances_${todayStr()}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Report exported')
    } catch {
      toast.error('Could not export the report')
    } finally {
      setExporting(false)
    }
  }

  const summary = data.summary || {
    customers: 0, customers_with_balance: 0, loans: 0,
    total_repayable: 0, total_paid: 0, total_outstanding: 0,
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/accounts')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <ArrowLeft size={20} className="dark:text-white" />
            </button>
            <div>
              <h2 className="text-2xl font-bold dark:text-white">Loan Balances</h2>
              <p className="text-gray-600 dark:text-gray-400">What each customer still owes on their loans</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
              >
                <Download size={16} /> {exporting ? 'Exporting...' : 'Export to Excel'}
              </button>
            )}
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-6 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Total Outstanding</p>
            </div>
            <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{formatCurrency(summary.total_outstanding)}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Repaid</p>
            </div>
            <p className="text-3xl font-bold text-green-700 dark:text-green-300">{formatCurrency(summary.total_paid)}</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">of {formatCurrency(summary.total_repayable)} repayable</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Customers Owing</p>
            </div>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{summary.customers_with_balance}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{summary.loans} {summary.loans === 1 ? 'loan' : 'loans'} in this view</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <h3 className="text-lg font-semibold dark:text-white">Balance by Customer</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customer or loan number..."
                  className="w-full pl-9 pr-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          {loading && data.customers.length === 0 ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full">
                <thead className="border-b dark:border-gray-700">
                  <tr>
                    <th className="text-left py-3 text-sm font-semibold dark:text-white">Customer</th>
                    <th className="text-right py-3 text-sm font-semibold dark:text-white">Loans</th>
                    <th className="text-right py-3 text-sm font-semibold dark:text-white">Total Repayable</th>
                    <th className="text-right py-3 text-sm font-semibold dark:text-white">Paid</th>
                    <th className="text-right py-3 text-sm font-semibold dark:text-white">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.customers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-500 dark:text-gray-400">
                        {search
                          ? 'No customers match your search'
                          : status === 'active'
                            ? 'No customer has an outstanding loan balance'
                            : 'No loans found'}
                      </td>
                    </tr>
                  ) : data.customers.map((c) => {
                    const isOpen = !!expanded[c.customer_id]
                    return (
                      <Fragment key={c.customer_id}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="py-3 text-sm dark:text-white">
                            <button
                              type="button"
                              onClick={() => toggle(c.customer_id)}
                              aria-expanded={isOpen}
                              className="inline-flex items-center gap-2 text-left"
                            >
                              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              {c.customer_name}
                            </button>
                          </td>
                          <td className="py-3 text-sm text-right dark:text-gray-300">{c.loans_count}</td>
                          <td className="py-3 text-sm text-right dark:text-gray-300">{formatCurrency(c.total_repayable)}</td>
                          <td className="py-3 text-sm text-right text-green-600 dark:text-green-400">{formatCurrency(c.total_paid)}</td>
                          <td className="py-3 text-sm text-right font-semibold text-orange-600 dark:text-orange-400">
                            {formatCurrency(c.outstanding_balance)}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={5} className="pb-4">
                              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="text-xs text-gray-500 dark:text-gray-400">
                                    <tr>
                                      <th className="text-left py-2">Loan</th>
                                      <th className="text-left py-2">Product</th>
                                      <th className="text-right py-2">Repayable</th>
                                      <th className="text-right py-2">Paid</th>
                                      <th className="text-right py-2">Outstanding</th>
                                      <th className="text-left py-2 pl-6">Last payment</th>
                                      <th className="text-left py-2">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {c.loans.map((l) => (
                                      <tr key={l.loan_id}>
                                        <td className="py-2 dark:text-white">{l.application_number}</td>
                                        <td className="py-2 text-gray-600 dark:text-gray-300">{l.product_name}</td>
                                        <td className="py-2 text-right dark:text-gray-300">{formatCurrency(l.total_repayable)}</td>
                                        <td className="py-2 text-right text-green-600 dark:text-green-400">{formatCurrency(l.total_paid)}</td>
                                        <td className="py-2 text-right font-medium text-orange-600 dark:text-orange-400">
                                          {formatCurrency(l.outstanding_balance)}
                                        </td>
                                        <td className="py-2 pl-6 text-gray-500 dark:text-gray-400">{formatDate(l.last_payment_date)}</td>
                                        <td className="py-2">
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                            l.status === 'paid'
                                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                          }`}>
                                            {l.status === 'paid' ? 'Paid' : 'Active'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}