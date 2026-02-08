export function Table({ children, className = '' }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${className}`}>
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ children }) {
  return (
    <thead className="bg-gray-50 dark:bg-gray-700">
      {children}
    </thead>
  )
}

export function TableBody({ children }) {
  return <tbody className="divide-y dark:divide-gray-700">{children}</tbody>
}

export function TableRow({ children, className = '' }) {
  return (
    <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${className}`}>
      {children}
    </tr>
  )
}

export function TableHead({ children, className = '' }) {
  return (
    <th className={`px-4 py-3 text-left text-sm font-semibold dark:text-white ${className}`}>
      {children}
    </th>
  )
}

export function TableCell({ children, className = '' }) {
  return (
    <td className={`px-4 py-3 text-sm dark:text-gray-300 ${className}`}>
      {children}
    </td>
  )
}