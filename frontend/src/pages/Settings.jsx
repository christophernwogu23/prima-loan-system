import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getSettings, updateSettings } from '../api/settings'
import { Building2, CreditCard, Settings as SettingsIcon, Save, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Settings() {
  const [settings, setSettings] = useState({
    // Company Info
    company_name: 'PRIMA',
    company_address: '',
    company_phone: '',
    company_logo: '',
    // Loan Settings
    default_interest_rate: '17.0',
    max_loan_amount: '10000000',
    min_loan_amount: '10000',
    late_payment_penalty: '5.0',
    // System Settings
    currency: 'NGN',
    currency_symbol: '₦',
    date_format: 'DD/MM/YYYY',
    force_password_change: 'true'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('company')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await getSettings()
      setSettings(data)
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (key, value) => {
    setSettings({ ...settings, [key]: value })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings(settings)
      toast.success('Settings saved successfully')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount)
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

  const tabs = [
    { id: 'company', label: 'Company Info', icon: Building2 },
    { id: 'loan', label: 'Loan Settings', icon: CreditCard },
    { id: 'system', label: 'System Settings', icon: SettingsIcon }
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-gray-600 dark:text-gray-400">Configure your system preferences</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b dark:border-gray-700">
          <nav className="flex gap-4">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Company Info Tab */}
        {activeTab === 'company' && (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Company Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={settings.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter company name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={settings.company_phone}
                  onChange={(e) => handleChange('company_phone', e.target.value)}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter phone number"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Address
                </label>
                <textarea
                  value={settings.company_address}
                  onChange={(e) => handleChange('company_address', e.target.value)}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter company address"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Logo URL
                </label>
                <input
                  type="text"
                  value={settings.company_logo}
                  onChange={(e) => handleChange('company_logo', e.target.value)}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter logo URL (optional)"
                />
                {settings.company_logo && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <img 
                      src={settings.company_logo} 
                      alt="Company Logo" 
                      className="h-16 object-contain"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loan Settings Tab */}
        {activeTab === 'loan' && (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Loan Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.default_interest_rate}
                  onChange={(e) => handleChange('default_interest_rate', e.target.value)}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Applied to new loan products by default
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Late Payment Penalty (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.late_payment_penalty}
                  onChange={(e) => handleChange('late_payment_penalty', e.target.value)}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Penalty applied for overdue payments
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minimum Loan Amount (₦)
                </label>
                <input
                  type="number"
                  value={settings.min_loan_amount}
                  onChange={(e) => handleChange('min_loan_amount', e.target.value)}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Currently: {formatCurrency(parseFloat(settings.min_loan_amount) || 0)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Maximum Loan Amount (₦)
                </label>
                <input
                  type="number"
                  value={settings.max_loan_amount}
                  onChange={(e) => handleChange('max_loan_amount', e.target.value)}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Currently: {formatCurrency(parseFloat(settings.max_loan_amount) || 0)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* System Settings Tab */}
        {activeTab === 'system' && (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">System Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Currency
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) => {
                    handleChange('currency', e.target.value)
                    if (e.target.value === 'NGN') handleChange('currency_symbol', '₦')
                    if (e.target.value === 'USD') handleChange('currency_symbol', '$')
                    if (e.target.value === 'GBP') handleChange('currency_symbol', '£')
                  }}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="NGN">Nigerian Naira (₦)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="GBP">British Pound (£)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date Format
                </label>
                <select
                  value={settings.date_format}
                  onChange={(e) => handleChange('date_format', e.target.value)}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.force_password_change === 'true'}
                    onChange={(e) => handleChange('force_password_change', e.target.checked ? 'true' : 'false')}
                    className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                  />
                  <div>
                    <span className="font-medium text-gray-700 dark:text-white">Force password change on first login</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      New users will be required to change their password when they first log in
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}