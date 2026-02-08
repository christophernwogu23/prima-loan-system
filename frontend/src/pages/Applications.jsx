import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { getApplications } from '../api/applications'

export default function Applications() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadApplications()
  }, [])

  const loadApplications = async () => {
    try {
      const data = await getApplications()
      setApplications(data)
    } catch (error) {
      console.error('Failed to load applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      submitted: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      under_review: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      approved: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      rejected: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      disbursed: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
    }
    return colors[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold dark:text-white">My Applications</h2>
        <Link 
          to="/apply-loan" 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Application
        </Link>
      </div>
      
      {loading ? (
        <p className="dark:text-white">Loading...</p>
      ) : applications.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No applications yet</p>
          <Link 
            to="/apply-loan" 
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Apply for a loan
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Application #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tenure
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 font-medium dark:text-white">
                    {app.application_number}
                  </td>
                  <td className="px-6 py-4 dark:text-gray-300">
                    ₦{app.requested_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 dark:text-gray-300">
                    {app.tenure_months} months
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {new Date(app.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}