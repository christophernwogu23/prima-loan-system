export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`p-6 border-b dark:border-gray-700 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`text-lg font-semibold dark:text-white ${className}`}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  )
}