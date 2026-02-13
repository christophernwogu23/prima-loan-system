import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './context/ThemeContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { useAuthStore } from './store/authStore'
import LoanProducts from './pages/LoanProducts'
import ApplyLoan from './pages/ApplyLoan'
import Applications from './pages/Applications'
import ReviewApplications from './pages/ReviewApplications'
//import Users from './pages/Users'
//import Reports from './pages/Reports'
import Payments from './pages/Payments'
import Settings from './pages/Settings'
import Expenses from './pages/Expenses'
import FixedDeposits from './pages/FixedDeposits'
import ImportData from './pages/ImportData'
import Shareholders from './pages/Shareholders'
import Defaults from './pages/Defaults'
import LoanOfficers from './pages/LoanOfficers'
import CustomerAssignment from './pages/CustomerAssignment'
import Savings from './pages/Savings'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/loan-products" element={<ProtectedRoute><LoanProducts /></ProtectedRoute>} />
          <Route path="/apply-loan" element={<ProtectedRoute><ApplyLoan /></ProtectedRoute>} />
          <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
          <Route path="/review-applications" element={<ProtectedRoute><ReviewApplications /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
          <Route path="/fixed-deposits" element={<ProtectedRoute><FixedDeposits /></ProtectedRoute>} />
          <Route path="/import" element={<ProtectedRoute><ImportData /></ProtectedRoute>} />
          <Route path="/shareholders" element={<ProtectedRoute><Shareholders /></ProtectedRoute>} />
          <Route path="/defaults" element={<ProtectedRoute><Defaults /></ProtectedRoute>} />
          <Route path="/loan-officers" element={<ProtectedRoute><LoanOfficers /></ProtectedRoute>} />
          <Route path="/customer-assignment" element={<ProtectedRoute><CustomerAssignment /></ProtectedRoute>} />
          <Route path="/savings" element={<ProtectedRoute><Savings /></ProtectedRoute>} />
          
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </ThemeProvider>
  )
}