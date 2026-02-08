import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { getLoanProducts, deleteLoanProduct } from '../api/loanProducts'
import { useAuthStore } from '../store/authStore'
import { Trash2 } from 'lucide-react'

export default function LoanProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const { user } = useAuthStore()

  // Check if user can delete (only admin and CEO)
  const canDelete = user?.role === 'admin' || user?.role === 'ceo'

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const data = await getLoanProducts()
      setProducts(data)
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (productId, productName) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${productName}"?\n\nThis action cannot be undone.`
    )
    
    if (!confirmed) return

    setDeleting(productId)
    try {
      await deleteLoanProduct(productId)
      alert('Loan product deleted successfully!')
      // Reload products
      loadProducts()
    } catch (error) {
      console.error('Failed to delete product:', error)
      const errorMessage = error.response?.data?.detail || 'Failed to delete loan product. It may be in use by existing applications.'
      alert(errorMessage)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-6 dark:text-white">Loan Products</h2>
      
      {loading ? (
        <p className="dark:text-white">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-6 relative shadow-sm hover:shadow-md transition-shadow">
              {canDelete && (
                <button
                  onClick={() => handleDelete(product.id, product.name)}
                  disabled={deleting === product.id}
                  className="absolute top-4 right-4 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete product"
                >
                  {deleting === product.id ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <Trash2 size={20} />
                  )}
                </button>
              )}
              
              <h3 className="text-xl font-semibold mb-2 pr-10 dark:text-white">{product.name}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{product.description}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Interest Rate:</span>
                  <span className="font-medium dark:text-white">{product.interest_rate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                  <span className="font-medium dark:text-white">₦{product.min_amount?.toLocaleString()} - ₦{product.max_amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Tenure:</span>
                  <span className="font-medium dark:text-white">{product.min_tenure_months} - {product.max_tenure_months} months</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}