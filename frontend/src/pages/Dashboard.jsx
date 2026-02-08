import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { getDashboardStats } from '../api/stats'
import { getMySavings } from '../api/savings'
import { 
  Users, FileText, CheckCircle, XCircle, 
  DollarSign, Clock, Package, TrendingUp, Wallet,
  AlertTriangle, Building, PiggyBank, CreditCard,
  ArrowRight, UserCheck, Briefcase
} from 'lucide-react'

// CustomerSlider Component
function CustomerSlider({ stats, navigate, formatCurrency }) {
  const [currentSlide, setCurrentSlide] = useState(0)

  const slides = [
    {
      id: 'savings',
      title: 'Savings',
      subtitle: 'Simple, Safe, Current Deposit, Earn Interest Immediately',
      balance: stats.savings_balance || 0,
      buttonText: 'View Savings',
      buttonAction: () => navigate('/savings'),
      gradient: 'from-blue-400 via-blue-500 to-indigo-600',
    },
    {
      id: 'loans',
      title: 'Active Loans',
      subtitle: 'Track your active loans and repayment progress',
      balance: stats.total_outstanding || 0,
      loanCount: stats.active_loans || 0,
      buttonText: 'View Loans',
      buttonAction: () => navigate('/applications'),
      gradient: 'from-purple-400 via-purple-500 to-pink-600',
    }
  ]

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  const goToSlide = (index) => {
    setCurrentSlide(index)
  }

  return (
    <div className="relative mb-4 md:mb-6">
      <div className="relative overflow-hidden rounded-xl md:rounded-2xl">
        <div 
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide) => (
            <div key={slide.id} className="min-w-full">
              <div className={`bg-gradient-to-r ${slide.gradient} text-white p-6 md:p-10 relative overflow-hidden min-h-[220px] md:min-h-[280px]`}>
                <div className="relative z-10">
                  <h2 className="text-2xl md:text-4xl font-bold mb-2 md:mb-3">{slide.title}</h2>
                  <p className="text-white/90 mb-4 md:mb-6 text-xs md:text-base">{slide.subtitle}</p>
                  
                  <div className="mb-4 md:mb-6">
                    {slide.id === 'savings' ? (
                      <>
                        <p className="text-white/80 text-xs mb-1">Balance</p>
                        <p className="text-3xl md:text-5xl font-bold">{formatCurrency(slide.balance)}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-white/80 text-xs mb-1">Outstanding Amount</p>
                        <p className="text-3xl md:text-5xl font-bold">{formatCurrency(slide.balance)}</p>
                        <p className="text-white/80 text-xs mt-2">{slide.loanCount} active loan(s)</p>
                      </>
                    )}
                  </div>
                  
                  <button
                    onClick={slide.buttonAction}
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm md:text-base font-medium transition-all"
                  >
                    {slide.buttonText}
                  </button>
                </div>

                <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-white/5 rounded-full -mr-24 md:-mr-32 -mt-24 md:-mt-32"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 md:w-48 md:h-48 bg-white/5 rounded-full -ml-16 md:-ml-24 -mb-16 md:-mb-24"></div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={prevSlide}
          className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-1.5 md:p-2 rounded-full transition-all z-20"
        >
          <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-2 md:right-4 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-1.5 md:p-2 rounded-full transition-all z-20"
        >
          <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="flex justify-center gap-2 mt-3 md:mt-4">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-1.5 md:h-2 rounded-full transition-all ${
              currentSlide === index 
                ? 'w-6 md:w-8 bg-blue-600 dark:bg-blue-500' 
                : 'w-1.5 md:w-2 bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>
    </div>
  )
}


export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const statsData = await getDashboardStats()
      setStats(statsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0)
  }

  const StatCard = ({ title, value, icon: Icon, color = 'blue', onClick }) => {
    const colors = {
      blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      yellow: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      indigo: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
      orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    }
    
    return (
      <div 
        className={`bg-white dark:bg-gray-800 border dark:border-gray-700 p-4 md:p-6 rounded-lg md:rounded-xl hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm truncate">{title}</p>
            <p className="text-lg md:text-2xl font-bold mt-1 dark:text-white break-all">{value}</p>
          </div>
          <div className={`p-2 md:p-3 rounded-lg flex-shrink-0 ${colors[color]}`}>
            <Icon className="w-5 h-5 md:w-6 md:h-6" />
          </div>
        </div>
        {onClick && (
          <div className="mt-2 md:mt-3 text-xs md:text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
            View details <ArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
          </div>
        )}
      </div>
    )
  }

  const HighlightCard = ({ title, value, subtitle, icon: Icon, gradient }) => (
    <div className={`${gradient} text-white p-4 md:p-6 rounded-lg md:rounded-xl shadow-lg`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white/80 text-xs md:text-sm truncate">{title}</p>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold mt-1 break-all">{value}</p>
          {subtitle && <p className="text-white/70 text-xs md:text-sm mt-1 truncate">{subtitle}</p>}
        </div>
        <div className="p-2 md:p-4 bg-white/20 rounded-lg flex-shrink-0">
          <Icon className="w-6 h-6 md:w-8 md:h-8" />
        </div>
      </div>
    </div>
  )

  const PendingItem = ({ app, onClick }) => (
    <div 
      className="flex items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm dark:text-white truncate">{app.application_number}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{formatCurrency(app.amount)}</p>
      </div>
      <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap flex-shrink-0 ${
        app.status === 'submitted' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
        app.status === 'officer_approved' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
        app.status === 'manager_approved' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300' :
        'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
      }`}>
        {app.status.replace('_', ' ')}
      </span>
    </div>
  )

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold dark:text-white">Welcome back, {user?.first_name}!</h2>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Here's what's happening today</p>
        </div>

        {/* Customer Dashboard */}
        {user?.role === 'customer' && (
          <>
            <CustomerSlider stats={stats} navigate={navigate} formatCurrency={formatCurrency} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <StatCard 
                title="Total Applications" 
                value={stats.total_applications || 0} 
                icon={FileText} 
                color="blue" 
              />
              <StatCard 
                title="Pending" 
                value={stats.pending_applications || 0} 
                icon={Clock} 
                color="yellow" 
              />
              <StatCard 
                title="Active Loans" 
                value={stats.active_loans || 0} 
                icon={CheckCircle} 
                color="green" 
              />
              <StatCard 
                title="Total Paid" 
                value={formatCurrency(stats.total_paid)} 
                icon={DollarSign} 
                color="purple" 
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl border dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base dark:text-white">Application Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="text-center p-3 md:p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-xl md:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.applications_summary?.submitted || 0}</p>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">Submitted</p>
                </div>
                <div className="text-center p-3 md:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.applications_summary?.in_progress || 0}</p>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">In Progress</p>
                </div>
                <div className="text-center p-3 md:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">{stats.applications_summary?.disbursed || 0}</p>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">Disbursed</p>
                </div>
                <div className="text-center p-3 md:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-xl md:text-2xl font-bold text-red-600 dark:text-red-400">{stats.applications_summary?.rejected || 0}</p>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">Rejected</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl border dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base dark:text-white">Quick Actions</h3>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <button 
                  onClick={() => navigate('/apply-loan')}
                  className="flex-1 bg-blue-600 text-white py-2.5 md:py-3 rounded-lg hover:bg-blue-700 transition-colors text-sm md:text-base font-medium"
                >
                  Apply for Loan
                </button>
                <button 
                  onClick={() => navigate('/applications')}
                  className="flex-1 border border-gray-300 dark:border-gray-600 py-2.5 md:py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors text-sm md:text-base font-medium"
                >
                  View Applications
                </button>
              </div>
            </div>
          </>
        )}

        {/* Loan Officer Dashboard */}
        {user?.role === 'loan_officer' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
              <HighlightCard 
                title="Pending Review"
                value={stats.pending_my_review || 0}
                subtitle="Awaiting your review"
                icon={Clock}
                gradient="bg-gradient-to-r from-orange-500 to-orange-600"
              />
              <HighlightCard 
                title="My Customers"
                value={stats.total_customers || 0}
                icon={Users}
                gradient="bg-gradient-to-r from-blue-500 to-blue-600"
              />
              <HighlightCard 
                title="Disbursed"
                value={formatCurrency(stats.disbursed_total)}
                icon={DollarSign}
                gradient="bg-gradient-to-r from-green-500 to-green-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <StatCard 
                title="Assigned to Me" 
                value={stats.assigned_applications || 0} 
                icon={FileText} 
                color="blue" 
              />
              <StatCard 
                title="Approved by Me" 
                value={stats.approved_by_me || 0} 
                icon={CheckCircle} 
                color="green" 
              />
              <StatCard 
                title="Rejected by Me" 
                value={stats.rejected_by_me || 0} 
                icon={XCircle} 
                color="red" 
              />
              <StatCard 
                title="My Customers" 
                value={stats.total_customers || 0} 
                icon={Users} 
                color="purple"
                onClick={() => navigate('/users')}
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl border dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base dark:text-white">My Applications Pipeline</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {Object.entries(stats.applications_by_status || {}).map(([status, count]) => (
                  <div key={status} className="flex-shrink-0 text-center p-3 md:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg min-w-[90px] md:min-w-[120px]">
                    <p className="text-xl md:text-2xl font-bold dark:text-white">{count}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{status.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
            </div>

            {stats.recent_applications?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl border dark:border-gray-700 p-4 md:p-6">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                  <h3 className="font-semibold text-sm md:text-base dark:text-white">Recent Applications</h3>
                  <button 
                    onClick={() => navigate('/review-applications')}
                    className="text-blue-600 dark:text-blue-400 text-xs md:text-sm flex items-center gap-1 hover:underline"
                  >
                    View all <ArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {stats.recent_applications.map((app) => (
                    <PendingItem 
                      key={app.id} 
                      app={app} 
                      onClick={() => navigate('/review-applications')}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl border dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base dark:text-white">Quick Actions</h3>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <button 
                  onClick={() => navigate('/review-applications')}
                  className="flex-1 bg-blue-600 text-white py-2.5 md:py-3 rounded-lg hover:bg-blue-700 transition-colors text-sm md:text-base font-medium"
                >
                  Review Applications
                </button>
                <button 
                  onClick={() => navigate('/users')}
                  className="flex-1 border border-gray-300 dark:border-gray-600 py-2.5 md:py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors text-sm md:text-base font-medium"
                >
                  My Customers
                </button>
              </div>
            </div>
          </>
        )}

        {/* Manager Dashboard */}
        {user?.role === 'manager' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
              <HighlightCard 
                title="Pending Review"
                value={stats.pending_my_review || 0}
                subtitle="Officer-reviewed"
                icon={Clock}
                gradient="bg-gradient-to-r from-orange-500 to-orange-600"
              />
              <HighlightCard 
                title="Disbursed"
                value={formatCurrency(stats.total_disbursed_amount)}
                icon={DollarSign}
                gradient="bg-gradient-to-r from-green-500 to-green-600"
              />
              <HighlightCard 
                title="This Month"
                value={stats.this_month_applications || 0}
                subtitle={formatCurrency(stats.this_month_amount)}
                icon={TrendingUp}
                gradient="bg-gradient-to-r from-blue-500 to-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <StatCard 
                title="Total Applications" 
                value={stats.total_applications || 0} 
                icon={FileText} 
                color="blue" 
              />
              <StatCard 
                title="Approved by Me" 
                value={stats.approved_by_me || 0} 
                icon={CheckCircle} 
                color="green" 
              />
              <StatCard 
                title="Total Rejected" 
                value={stats.rejected_total || 0} 
                icon={XCircle} 
                color="red" 
              />
              <StatCard 
                title="Pending Review" 
                value={stats.pending_my_review || 0} 
                icon={Clock} 
                color="yellow"
                onClick={() => navigate('/review-applications')}
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl border dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base dark:text-white">Applications Pipeline</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {Object.entries(stats.applications_by_status || {}).map(([status, count]) => (
                  <div key={status} className="flex-shrink-0 text-center p-3 md:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg min-w-[90px] md:min-w-[120px]">
                    <p className="text-xl md:text-2xl font-bold dark:text-white">{count}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{status.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
            </div>

            {stats.pending_applications?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl border dark:border-gray-700 p-4 md:p-6">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                  <h3 className="font-semibold text-sm md:text-base dark:text-white">Awaiting Your Review</h3>
                  <button 
                    onClick={() => navigate('/review-applications')}
                    className="text-blue-600 dark:text-blue-400 text-xs md:text-sm flex items-center gap-1 hover:underline"
                  >
                    View all <ArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {stats.pending_applications.map((app) => (
                    <PendingItem 
                      key={app.id} 
                      app={app} 
                      onClick={() => navigate('/review-applications')}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* CEO Dashboard */}
        {user?.role === 'ceo' && (
          <>
            {/* Top Stats with Mini Charts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {/* Total Disbursed */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 md:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Total Disbursed</p>
                      <p className="text-xl md:text-2xl font-bold dark:text-white">{formatCurrency(stats.total_disbursed)}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {stats.disbursed_growth || 0}%
                  </span>
                </div>
                <div className="h-12 bg-white/50 dark:bg-gray-800/50 rounded-lg flex items-end p-1.5 gap-0.5">
                  {[30, 45, 35, 50, 55, 60, 70].map((h, i) => (
                    <div key={i} className="flex-1 bg-purple-500 rounded-t" style={{height: `${h}%`}}></div>
                  ))}
                </div>
              </div>

              {/* Total Paid */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-700 rounded-xl p-4 md:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Paid Amount</p>
                      <p className="text-xl md:text-2xl font-bold dark:text-white">{formatCurrency(stats.total_paid)}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {stats.paid_growth || 0}%
                  </span>
                </div>
                <div className="h-12 bg-white/50 dark:bg-gray-800/50 rounded-lg flex items-end p-1.5 gap-0.5">
                  {[40, 50, 45, 55, 60, 65, 75].map((h, i) => (
                    <div key={i} className="flex-1 bg-green-500 rounded-t" style={{height: `${h}%`}}></div>
                  ))}
                </div>
              </div>

              {/* Remaining Balance */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 md:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <Wallet className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Remaining Balance</p>
                      <p className="text-xl md:text-2xl font-bold dark:text-white">{formatCurrency(stats.remaining_balance)}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold flex items-center gap-1 ${
                    (stats.balance_growth || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    <TrendingUp className="w-3 h-3" />
                    {Math.abs(stats.balance_growth || 0)}%
                  </span>
                </div>
                <div className="h-12 bg-white/50 dark:bg-gray-800/50 rounded-lg flex items-end p-1.5 gap-0.5">
                  {[50, 55, 50, 45, 40, 35, 30].map((h, i) => (
                    <div key={i} className="flex-1 bg-blue-500 rounded-t" style={{height: `${h}%`}}></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-3 md:p-4">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    placeholder="Search application number, customer name..."
                    className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-gray-700 dark:text-white text-sm"
                  />
                  <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 md:px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium dark:text-white flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    <span className="hidden sm:inline">Sort</span>
                  </button>
                  <button className="px-3 md:px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium dark:text-white flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <span className="hidden sm:inline">Filter</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Applications Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
              <div className="p-4 md:p-5 border-b dark:border-gray-700">
                <h3 className="font-semibold text-base dark:text-white">Recent Applications</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">App #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount (₦)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {stats.recent_applications?.length > 0 ? (
                      stats.recent_applications.map((app) => (
                        <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium dark:text-white">{app.application_number}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                {app.customer_name?.charAt(0) || 'C'}
                              </div>
                              <span className="text-sm dark:text-white">{app.customer_name || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{app.product_name}</td>
                          <td className="px-4 py-3 text-sm font-medium dark:text-white">{formatCurrency(app.amount)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {app.created_at ? new Date(app.created_at).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                              app.status === 'disbursed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                              app.status === 'manager_approved' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                              app.status === 'submitted' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                              app.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                            }`}>
                              {app.status.replace('_', ' ').charAt(0).toUpperCase() + app.status.replace('_', ' ').slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          No applications found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* View All Button */}
              {stats.recent_applications?.length > 0 && (
                <div className="p-4 border-t dark:border-gray-700">
                  <button 
                    onClick={() => navigate('/review-applications')}
                    className="w-full text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline flex items-center justify-center gap-1"
                  >
                    View all applications <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 text-center">
                <Users className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold dark:text-white">{stats.total_customers || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Customers</p>
              </div>
              <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 text-center">
                <Briefcase className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold dark:text-white">{stats.total_staff || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Staff</p>
              </div>
              <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 text-center">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-500" />
                <p className="text-2xl font-bold dark:text-white">{stats.defaults_count || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Defaults</p>
              </div>
              <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 text-center">
                <PiggyBank className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                <p className="text-lg md:text-xl font-bold dark:text-white break-all">{formatCurrency(stats.total_savings)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Savings</p>
              </div>
              <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 text-center">
                <Building className="w-6 h-6 mx-auto mb-2 text-indigo-500" />
                <p className="text-lg md:text-xl font-bold dark:text-white break-all">{formatCurrency(stats.total_fixed_deposits)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Fixed Deposits</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
              <button 
                onClick={() => navigate('/review-applications')}
                className="bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Applications
              </button>
              <button 
                onClick={() => navigate('/defaults')}
                className="bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Defaults
              </button>
              <button 
                onClick={() => navigate('/shareholders')}
                className="bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                Shareholders
              </button>
              <button 
                onClick={() => navigate('/reports')}
                className="bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Analytics
              </button>
            </div>
          </>
        )}

        {/* Admin Dashboard */}
        {user?.role === 'admin' && stats && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              <HighlightCard 
                title="Total Users"
                value={stats.total_users || 0}
                icon={Users}
                gradient="bg-gradient-to-r from-blue-500 to-blue-600"
              />
              <HighlightCard 
                title="Disbursed"
                value={formatCurrency(stats.total_disbursed || 0)}
                icon={DollarSign}
                gradient="bg-gradient-to-r from-green-500 to-green-600"
              />
              <HighlightCard 
                title="Savings"
                value={formatCurrency(stats.total_savings || 0)}
                icon={PiggyBank}
                gradient="bg-gradient-to-r from-purple-500 to-purple-600"
              />
              <HighlightCard 
                title="Fixed Deposits"
                value={formatCurrency(stats.total_fixed_deposits || 0)}
                icon={Building}
                gradient="bg-gradient-to-r from-indigo-500 to-indigo-600"
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl border dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base dark:text-white">Users by Role</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
                {Object.entries(stats.users_by_role || {}).map(([role, count]) => (
                  <div key={role} className="text-center p-3 md:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-xl md:text-2xl font-bold dark:text-white">{count}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{role.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <StatCard 
                title="Applications" 
                value={stats.total_applications || 0} 
                icon={FileText} 
                color="blue" 
              />
              <StatCard 
                title="Products" 
                value={stats.active_products || 0} 
                icon={Package} 
                color="purple" 
              />
              <StatCard 
                title="Capital" 
                value={formatCurrency(stats.shareholder_capital)} 
                icon={UserCheck} 
                color="green" 
              />
              <StatCard 
                title="Expenses" 
                value={formatCurrency(stats.total_expenses)} 
                icon={CreditCard} 
                color="red" 
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl border dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base dark:text-white">Applications Pipeline</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {Object.entries(stats.applications_by_status || {}).map(([status, count]) => (
                  <div key={status} className="flex-shrink-0 text-center p-3 md:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg min-w-[90px] md:min-w-[120px]">
                    <p className="text-xl md:text-2xl font-bold dark:text-white">{count}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{status.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
            </div>

            {stats.recent_applications?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl border dark:border-gray-700 p-4 md:p-6">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                  <h3 className="font-semibold text-sm md:text-base dark:text-white">Recent Applications</h3>
                  <button 
                    onClick={() => navigate('/review-applications')}
                    className="text-blue-600 dark:text-blue-400 text-xs md:text-sm flex items-center gap-1 hover:underline"
                  >
                    View all <ArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {stats.recent_applications.map((app) => (
                    <PendingItem 
                      key={app.id} 
                      app={app} 
                      onClick={() => navigate('/review-applications')}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl border dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base dark:text-white">Quick Actions</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                <button 
                  onClick={() => navigate('/users')}
                  className="bg-blue-600 text-white py-2.5 md:py-3 rounded-lg hover:bg-blue-700 transition-colors text-xs md:text-sm font-medium"
                >
                  Users
                </button>
                <button 
                  onClick={() => navigate('/loan-products')}
                  className="border border-gray-300 dark:border-gray-600 py-2.5 md:py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors text-xs md:text-sm font-medium"
                >
                  Products
                </button>
                <button 
                  onClick={() => navigate('/import')}
                  className="border border-gray-300 dark:border-gray-600 py-2.5 md:py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors text-xs md:text-sm font-medium"
                >
                  Import
                </button>
                <button 
                  onClick={() => navigate('/settings')}
                  className="border border-gray-300 dark:border-gray-600 py-2.5 md:py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors text-xs md:text-sm font-medium"
                >
                  Settings
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}