import { useAuthStore } from '../store/authStore'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { 
  Package, FileText, Users, CreditCard, LogOut, 
  PlusCircle, ClipboardList, BarChart3, Settings, Receipt, Wallet, 
  Landmark, Upload, UserCheck, AlertTriangle, Bell, Moon, Sun, Menu, X, BookOpen
} from 'lucide-react'
import { getMyNotifications, markAllAsRead } from '../api/notifications'
import { useTheme } from '../context/ThemeContext'

export default function Layout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const notificationRef = useRef(null)
  const { isDark, toggleTheme } = useTheme()

  useEffect(() => {
    loadNotifications()
    
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const loadNotifications = async () => {
    try {
      const data = await getMyNotifications()
      setNotifications(data)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead()
      loadNotifications()
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getNotificationIcon = (type) => {
  switch(type) {
    case 'application_approved':
    case 'application_rejected':
      return <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
    case 'payment_recorded':
      return <Receipt className="w-5 h-5 text-green-600 dark:text-green-400" />
    case 'payment_due_soon':
      return <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
    case 'review_needed':
      return <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
    default:
      return <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
  }
}

  const formatNotificationDate = (date) => {
    const now = new Date()
    const notifDate = new Date(date)
    const diffMs = now - notifDate
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return notifDate.toLocaleDateString()
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const menuItems = {
  customer: [
    { path: '/dashboard', label: 'Dashboard', icon: CreditCard },
    { path: '/savings', label: 'Savings', icon: Wallet },
    { path: '/loan-products', label: 'Loan Products', icon: Package },
    { path: '/apply-loan', label: 'Apply for Loan', icon: PlusCircle },
    { path: '/applications', label: 'My Applications', icon: FileText },
  ],
  loan_officer: [
    { path: '/dashboard', label: 'Dashboard', icon: CreditCard },
    { path: '/users', label: 'Users', icon: Users },
    { path: '/accounts', label: 'Accounts', icon: Wallet },
    { path: '/review-applications', label: 'All Applications', icon: ClipboardList },
    { path: '/upfront', label: 'Upfront Charges', icon: Receipt },
    { path: '/settings', label: 'Settings', icon: Settings },
    { path: '/reports', label: 'Analytics', icon: BarChart3 },
    { path: '/defaults', label: 'Defaults', icon: AlertTriangle },
    { path: '/payments', label: 'Payments', icon: Receipt },
  ],
  manager: [
    { path: '/dashboard', label: 'Dashboard', icon: CreditCard },
    { path: '/users', label: 'Users', icon: Users },
    { path: '/accounts', label: 'Accounts', icon: Wallet },
    { path: '/review-applications', label: 'All Applications', icon: ClipboardList },
    { path: '/upfront', label: 'Upfront Charges', icon: Receipt },
    { path: '/customer-assignment', label: 'Customer Assignment', icon: UserCheck },
    { path: '/settings', label: 'Settings', icon: Settings },
    { path: '/reports', label: 'Analytics', icon: BarChart3 },
    { path: '/defaults', label: 'Defaults', icon: AlertTriangle },
    { path: '/payments', label: 'Payments', icon: Receipt },
    { path: '/expenses', label: 'Expenses', icon: Wallet },
    { path: '/fixed-deposits', label: 'Fixed Deposits', icon: Landmark },
    { path: '/shareholders', label: 'Shareholders', icon: UserCheck },
    { path: '/gl/chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
    { path: '/gl/journal-entries', label: 'Journal Entries', icon: BookOpen },
  ],
  ceo: [
    { path: '/dashboard', label: 'Dashboard', icon: CreditCard },
    { path: '/users', label: 'Users', icon: Users },
    { path: '/accounts', label: 'Accounts', icon: Wallet },
    { path: '/review-applications', label: 'All Applications', icon: ClipboardList },
    { path: '/upfront', label: 'Upfront Charges', icon: Receipt },
    { path: '/settings', label: 'Settings', icon: Settings },
    { path: '/reports', label: 'Analytics', icon: BarChart3 },
    { path: '/defaults', label: 'Defaults', icon: AlertTriangle },
    { path: '/payments', label: 'Payments', icon: Receipt },
    { path: '/expenses', label: 'Expenses', icon: Wallet },
    { path: '/fixed-deposits', label: 'Fixed Deposits', icon: Landmark },
    { path: '/shareholders', label: 'Shareholders', icon: UserCheck },
    { path: '/gl/chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
    { path: '/gl/journal-entries', label: 'Journal Entries', icon: BookOpen },
  ],
  admin: [
    { path: '/dashboard', label: 'Dashboard', icon: CreditCard },
    { path: '/users', label: 'Users', icon: Users },
    { path: '/accounts', label: 'Accounts', icon: Wallet },
    { path: '/review-applications', label: 'All Applications', icon: ClipboardList },
    { path: '/upfront', label: 'Upfront Charges', icon: Receipt },
    { path: '/settings', label: 'Settings', icon: Settings },
    { path: '/reports', label: 'Analytics', icon: BarChart3 },
    { path: '/defaults', label: 'Defaults', icon: AlertTriangle },
    { path: '/payments', label: 'Payments', icon: Receipt },
    { path: '/expenses', label: 'Expenses', icon: Wallet },
    { path: '/fixed-deposits', label: 'Fixed Deposits', icon: Landmark },
    { path: '/shareholders', label: 'Shareholders', icon: UserCheck },
    { path: '/gl/chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
    { path: '/gl/journal-entries', label: 'Journal Entries', icon: BookOpen },
    { path: '/import', label: 'Import Data', icon: Upload },
    { path: '/customer-assignment', label: 'Customer Assignment', icon: UserCheck },
  ],
}

  const currentMenu = menuItems[user?.role] || menuItems.customer

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 md:px-6 py-4 flex justify-between items-center transition-colors">
        {/* Left Side - Logo and Menu Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? (
              <X size={24} className="dark:text-white" />
            ) : (
              <Menu size={24} className="dark:text-white" />
            )}
          </button>
          <h1 className="text-lg md:text-xl font-bold text-blue-600 dark:text-blue-400">PRIMA</h1>
        </div>

        {/* Right Side - User Info and Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-xs md:text-sm dark:text-gray-300 hidden sm:inline">Welcome, {user?.first_name}</span>
          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded capitalize">
            {user?.role?.replace('_', ' ')}
          </span>
          
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun size={18} className="text-yellow-500" />
            ) : (
              <Moon size={18} className="text-gray-600" />
            )}
          </button>
          
          {/* Notification Bell */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Bell size={18} className="text-gray-600 dark:text-gray-300" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 z-50 max-h-[500px] overflow-hidden flex flex-col">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                  <h3 className="font-semibold dark:text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                      <p className="text-sm">No notifications</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                          !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                              {formatNotificationDate(notification.date)}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="flex-shrink-0">
                              <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={handleLogout} 
            className="flex items-center gap-1 text-xs md:text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            <LogOut size={14} className="md:w-4 md:h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>

      <div className="flex relative">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 min-h-screen p-4 transition-colors">
          <nav className="space-y-2">
            {currentMenu.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            ></div>
            
            {/* Mobile Menu */}
            <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 z-50 lg:hidden overflow-y-auto shadow-xl">
              <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">PRIMA</h1>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X size={20} className="dark:text-white" />
                  </button>
                </div>
                
                <nav className="space-y-2">
                  {currentMenu.map((item) => {
                    const isActive = location.pathname === item.path
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          isActive 
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <item.icon size={20} />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    )
                  })}
                </nav>

                {/* Mobile Logout */}
                <div className="mt-6 pt-6 border-t dark:border-gray-700">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <LogOut size={20} />
                    <span className="text-sm">Logout</span>
                  </button>
                </div>
              </div>
            </aside>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors">
          {children}
        </main>
      </div>
    </div>
  )
}