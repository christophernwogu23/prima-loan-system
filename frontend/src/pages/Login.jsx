import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(email, password)
    if (result.success) {
      toast.success('Welcome!')
      navigate('/dashboard')
    } else {
      toast.error(typeof result.error === 'string' ? result.error : result.error?.msg || result.error?.detail || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-blue-600 dark:bg-gray-900 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 w-full max-w-md shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-2 dark:text-white">PRIMA</h1>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-6">Loan Management System</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
              required 
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}