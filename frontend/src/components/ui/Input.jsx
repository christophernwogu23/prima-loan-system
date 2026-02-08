export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium dark:text-gray-300">
          {label}
        </label>
      )}
      <input
        className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : ''
        } ${className}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium dark:text-gray-300">
          {label}
        </label>
      )}
      <select
        className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}