import { useState, useEffect } from 'react'
import api from '../api/axios'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ApplyForCustomerModal({ customer, onClose, onSuccess }) {
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
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await api.get('/loan-products')
      setProducts(res.data.filter(p => p.is_active))
    } catch (err) {
      toast.error('Failed to load loan products')
    } finally {
      setLoading(false)
    }
  }

  const handleProductChange = (productId) => {
    setFormData({ ...formData, loan_product_id: productId })
    const product = products.find(p => p.id === parseInt(productId))
    setSelectedProduct(product)
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await api.post('/applications/', {
        loan_product_id: parseInt(formData.loan_product_id),
        requested_amount: parseFloat(formData.requested_amount),
        tenure_months: parseInt(formData.tenure_months),
        purpose: formData.purpose || null,
        customer_id: customer.id
      })
      toast.success(`Loan application submitted for ${customer.first_name} ${customer.last_name}`)
      onSuccess?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-bold">Apply for Loan</h2>
            <p className="text-sm text-gray-500">For: {customer.first_name} {customer.last_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Product</label>
            <select
              value={formData.loan_product_id}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            >
              <option value="">Select a product</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.interest_rate}% interest
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="bg-blue-50 p-3 rounded-lg text-sm">
              <p><strong>Amount Range:</strong> {formatCurrency(selectedProduct.min_amount)} - {formatCurrency(selectedProduct.max_amount)}</p>
              <p><strong>Tenure:</strong> {selectedProduct.min_tenure_months} - {selectedProduct.max_tenure_months} months</p>
              <p><strong>Interest Rate:</strong> {selectedProduct.interest_rate}%</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requested Amount (₦)</label>
            <input
              type="number"
              value={formData.requested_amount}
              onChange={(e) => setFormData({ ...formData, requested_amount: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder={selectedProduct ? `${selectedProduct.min_amount} - ${selectedProduct.max_amount}` : ''}
              min={selectedProduct?.min_amount}
              max={selectedProduct?.max_amount}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenure (months)</label>
            <input
              type="number"
              value={formData.tenure_months}
              onChange={(e) => setFormData({ ...formData, tenure_months: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder={selectedProduct ? `${selectedProduct.min_tenure_months} - ${selectedProduct.max_tenure_months}` : ''}
              min={selectedProduct?.min_tenure_months}
              max={selectedProduct?.max_tenure_months}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
            <textarea
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              rows="3"
              placeholder="What is the loan for?"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}