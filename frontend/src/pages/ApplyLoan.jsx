import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { getLoanProducts } from '../api/loanProducts'
import { createApplication } from '../api/applications'
import toast from 'react-hot-toast'

export default function ApplyLoan() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    loan_product_id: '',
    requested_amount: '',
    tenure_months: '',
    purpose: ''
  })

  const [selectedProduct, setSelectedProduct] = useState(null)

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

  const handleProductChange = (e) => {
    const productId = e.target.value
    setFormData({ ...formData, loan_product_id: productId })
    const product = products.find(p => p.id === parseInt(productId))
    setSelectedProduct(product)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      await createApplication({
        loan_product_id: parseInt(formData.loan_product_id),
        requested_amount: parseFloat(formData.requested_amount),
        tenure_months: parseInt(formData.tenure_months),
        purpose: formData.purpose
      })
      toast.success('Application submitted successfully!')
      navigate('/applications')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-6 dark:text-white">Apply for a Loan</h2>
      
      <div className="max-w-2xl bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Loan Product */}
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">Select Loan Product</label>
            <select
              value={formData.loan_product_id}
              onChange={handleProductChange}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Choose a loan product...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.interest_rate}% interest
                </option>
              ))}
            </select>
          </div>

          {/* Product Details */}
          {selectedProduct && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg text-sm">
              <p className="dark:text-gray-300">
                <strong className="dark:text-blue-400">Amount Range:</strong> ₦{selectedProduct.min_amount.toLocaleString()} - ₦{selectedProduct.max_amount.toLocaleString()}
              </p>
              <p className="dark:text-gray-300">
                <strong className="dark:text-blue-400">Tenure:</strong> {selectedProduct.min_tenure_months} - {selectedProduct.max_tenure_months} months
              </p>
              <p className="dark:text-gray-300">
                <strong className="dark:text-blue-400">Interest Rate:</strong> {selectedProduct.interest_rate}%
              </p>
            </div>
          )}

          {/* Requested Amount */}
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">Requested Amount (₦)</label>
            <input
              type="number"
              value={formData.requested_amount}
              onChange={(e) => setFormData({ ...formData, requested_amount: e.target.value })}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter amount"
              required
            />
          </div>

          {/* Tenure */}
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">Loan Tenure (months)</label>
            <input
              type="number"
              value={formData.tenure_months}
              onChange={(e) => setFormData({ ...formData, tenure_months: e.target.value })}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter tenure in months"
              required
            />
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">Purpose of Loan</label>
            <textarea
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Describe why you need this loan..."
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </Layout>
  )
}