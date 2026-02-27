import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Printer, ArrowLeft, Loader } from 'lucide-react'
import client from '../../api/client'
import toast from 'react-hot-toast'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2 }).format(amount)

export default function OfferLetter() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const printRef = useRef()

  useEffect(() => {
    client.get(`/applications/${id}/offer-letter`)
      .then(r => setData(r.data))
      .catch(e => toast.error(e.response?.data?.detail || 'Failed to load offer letter'))
      .finally(() => setLoading(false))
  }, [id])

  const handlePrint = () => window.print()

  if (loading) return (
    <div className="flex justify-center items-center h-screen">
      <Loader className="animate-spin text-blue-600" size={40} />
    </div>
  )

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <p className="text-gray-500">Could not load offer letter.</p>
      <button onClick={() => navigate(-1)} className="text-blue-600 underline">Go Back</button>
    </div>
  )

  const { loan, customer, letter_date, application_number } = data

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toolbar - hidden on print */}
      <div className="no-print flex items-center gap-4 p-4 bg-white shadow sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
          <ArrowLeft size={20} /> Back
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 ml-auto"
        >
          <Printer size={18} /> Print / Save as PDF
        </button>
      </div>

      {/* Letter */}
      <div className="flex justify-center py-8 px-4">
        <div ref={printRef} id="offer-letter" className="bg-white w-[794px] min-h-[1123px] p-16 shadow-lg print:shadow-none print:p-12 relative">
          
          {/* Header */}
          <div className="flex flex-col items-center mb-8 border-b-2 border-purple-700 pb-6">
            <img src="/logo.png" alt="Prima Logo" className="h-16 mb-2" onError={e => e.target.style.display='none'} />
            <h1 className="text-3xl font-extrabold text-purple-800 tracking-wide">PRIMA TREASURE</h1>
            <p className="text-sm text-gray-500 italic">Empowerment Initiative</p>
            <h2 className="text-xl font-bold text-gray-800 mt-3 underline">Loan Offer Letter</h2>
          </div>

          {/* Date & Customer */}
          <p className="text-sm mb-6">{letter_date}</p>

          <div className="mb-6">
            <p className="font-bold text-sm">MR/MRS {customer.name}</p>
            {customer.address && <p className="text-sm">{customer.address.toUpperCase()}</p>}
            {customer.city && <p className="text-sm">{customer.city.toUpperCase()}</p>}
            {customer.state && <p className="text-sm">{customer.state.toUpperCase()}</p>}
          </div>

          {/* Summary boxes */}
          <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
            <div className="border border-gray-300 rounded p-3">
              <p className="text-gray-500 text-xs">Monthly Repayment</p>
              <p className="font-bold text-base">₦{formatCurrency(loan.monthly_repayment)}</p>
            </div>
            <div className="border border-gray-300 rounded p-3">
              <p className="text-gray-500 text-xs">Duration</p>
              <p className="font-bold text-base">{loan.tenure_months} Months</p>
            </div>
            <div className="border border-gray-300 rounded p-3">
              <p className="text-gray-500 text-xs">Due Date</p>
              <p className="font-bold text-base">{loan.due_date}</p>
            </div>
            <div className="border border-gray-300 rounded p-3 col-span-3">
              <p className="text-gray-500 text-xs">First Repayment Date</p>
              <p className="font-bold text-base">{loan.first_repayment_date}</p>
            </div>
          </div>

          {/* Loan Breakdown Table */}
          <table className="w-full border border-gray-400 mb-6 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 px-4 py-2 text-left">Description</th>
                <th className="border border-gray-400 px-4 py-2 text-right">Principal Amount / Interest Rate (%)</th>
                <th className="border border-gray-400 px-4 py-2 text-right">Total (Naira)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-400 px-4 py-2">{loan.product_name.toUpperCase()} DISBURSEMENT</td>
                <td className="border border-gray-400 px-4 py-2 text-right">{formatCurrency(loan.principal)}</td>
                <td className="border border-gray-400 px-4 py-2 text-right">{formatCurrency(loan.principal)}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 px-4 py-2">INTEREST RATE</td>
                <td className="border border-gray-400 px-4 py-2 text-right">{loan.interest_rate}%</td>
                <td className="border border-gray-400 px-4 py-2 text-right">{formatCurrency(loan.interest_amount)}</td>
              </tr>
              <tr className="bg-gray-50 font-bold">
                <td className="border border-gray-400 px-4 py-2" colSpan={2}>Total (Loan & Interest Amount)</td>
                <td className="border border-gray-400 px-4 py-2 text-right">N{formatCurrency(loan.total_amount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Body */}
          <p className="text-sm mb-4">
            We are pleased to offer you the above LOAN DISBURSEMENT AMOUNT as loan under the following Terms and Conditions
          </p>

          <ol className="list-decimal list-inside text-sm space-y-2 mb-6 ml-2">
            <li><strong>{loan.interest_rate}%</strong> Interest rate on the loan with duration of <strong>{loan.tenure_months} Months</strong></li>
            <li>
              Your monthly repayment of <strong>₦{formatCurrency(loan.monthly_repayment)}</strong> with first repayment 
              due on <strong>{loan.first_repayment_date}</strong> after which every the same date on the consequent months 
              for the outstanding repayment. Your loan is deem to be liquidated latest by <strong>{loan.due_date}</strong>
            </li>
            <li>{loan.risk_premium_rate}% risk premium on loan to be taken upfront before disbursement</li>
            <li>{loan.admin_fee_rate}% Administrative fee to be taken upfront before disbursement</li>
            <li>A default rate of {loan.default_rate}% will be charged daily until the sum is repaid</li>
            <li>Management can at any time request for the loan inclusive of interest portion before maturity</li>
          </ol>

          <p className="text-sm mb-6">
            Kindly endorse the <strong>ACCEPTANCE OF OFFER</strong> and return a copy to us if you are okay with the Terms and Conditions
          </p>

          <p className="text-sm mb-1">Thank you</p>
          <p className="text-sm mb-1">Yours faithfully,</p>
          <p className="text-sm font-bold">For: PRIMA EMPOWERMENT INITIATIVE</p>

          <div className="mt-10 mb-8">
            <div className="border-t border-gray-400 w-48 mt-12 pt-1">
              <p className="text-sm font-bold">Authorised Signatory</p>
            </div>
          </div>

          {/* Acceptance Section */}
          <div className="border-t-2 border-gray-800 pt-4">
            <h3 className="text-center font-bold text-sm mb-3 underline">ACCEPTANCE OF OFFER</h3>
            <p className="text-sm mb-6">
              I, of above address, have read the Terms and Conditions for sum of above LOAN DISBURSEMENT AMOUNT 
              to be availed to me by PRIMA TREASURE EMPOWERMENT INITIATIVE. I have agreed in totally and it becomes binding
            </p>
            <div className="space-y-6 text-sm">
              <div className="flex items-end gap-2">
                <span>Name</span>
                <div className="flex-1 border-b border-dotted border-gray-500 mb-1"></div>
              </div>
              <div className="flex items-end gap-2">
                <span>Signature &amp; Date</span>
                <div className="flex-1 border-b border-dotted border-gray-500 mb-1"></div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-8 left-0 right-0 text-center border-t border-gray-300 pt-3 mx-16">
            <p className="text-xs text-gray-500">100, Akarigbo Road, Ijoku, Sagamu, Ogun State, Nigeria.</p>
            <p className="text-xs text-gray-500">+234 (0) 813 856 1813</p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          #offer-letter { box-shadow: none; margin: 0; }
        }
      `}</style>
    </div>
  )
}