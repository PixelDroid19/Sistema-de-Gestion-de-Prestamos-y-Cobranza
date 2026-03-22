import React from 'react'

function DataTable({ columns = [], rows = [], emptyState = null, rowKey = 'id', className = '' }) {
  if (!rows.length && emptyState) {
    return emptyState
  }

  return (
    <div className={`lf-data-table ${className}`.trim()}>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.className}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row[rowKey] ?? `${rowKey}-${index}`}>
                {columns.map((column) => (
                  <td key={column.key} className={column.cellClassName}>
                    {typeof column.render === 'function' ? column.render(row, index) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DataTable
