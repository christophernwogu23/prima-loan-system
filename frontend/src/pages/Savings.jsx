import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getMySavings } from '../api/savings'
import { Wallet, TrendingUp, Calendar, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Savings() {
  const [savings, setSavings] = useState(null)
  const [loading, setLoading] = useState(true)

  console.log('Savings component mounted')  // Add this
  console.log('Loading state:', loading)    // Add this
  console.log('Savings data:', savings)     // Add this

  useEffect(() => {
    loadSavings()
  }, [])

  const loadSavings = async () => {
    console.log('loadSavings called')  // Add this
    try {
      const data = await getMySavings()
      console.log('Received data:', data)  // Add this
      setSavings(data)
    } catch (error) {
      console.error('Failed to load savings:', error)
      toast.error('Failed to load savings')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

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
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold dark:text-white">My Savings Account</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage your savings and track your growth</p>
        </div>

        {/* Main Balance Card - Gradient stays the same in dark mode */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl p-8 relative overflow-hidden shadow-lg">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-6 h-6" />
              <p className="text-white/90 font-medium">Current Balance</p>
            </div>
            
            <h1 className="text-5xl font-bold mb-6">{formatCurrency(savings?.balance)}</h1>
            
            <div className="flex items-center gap-6">
              <div>
                <p className="text-white/80 text-sm">Account Status</p>
                <p className="font-semibold">Active</p>
              </div>
              <div>
                <p className="text-white/80 text-sm">Last Updated</p>
                <p className="font-semibold">
                  {savings?.updated_at ? new Date(savings.updated_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Illustration */}
          <div className="absolute right-8 bottom-8 opacity-20">
            <svg className="w-32 h-32" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="3" />
              <path d="M50 30 L50 70 M30 50 L70 50" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Minimum Balance</p>
                <p className="text-xl font-bold dark:text-white">{formatCurrency(0)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">No minimum required</p>
          </div>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Account Type</p>
                <p className="text-xl font-bold dark:text-white">Current</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Instant access anytime</p>
          </div>
        </div>

        
      </div>
    </Layout>
  )
}