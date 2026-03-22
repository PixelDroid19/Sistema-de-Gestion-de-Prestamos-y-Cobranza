import React from 'react'

function FilterBar({ children, className = '' }) {
  return <div className={`lf-filter-bar ${className}`.trim()}>{children}</div>
}

export default FilterBar
