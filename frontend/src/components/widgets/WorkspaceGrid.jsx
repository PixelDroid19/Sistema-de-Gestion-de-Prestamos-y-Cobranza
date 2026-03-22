import React from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'

const ResponsiveGrid = WidthProvider(Responsive)

function WorkspaceGrid({ children, layouts, cols, breakpoints, rowHeight = 96, isDraggable = false, isResizable = false, margin = [20, 20] }) {
  return (
    <ResponsiveGrid
      className="lf-grid-layout"
      layouts={layouts}
      cols={cols || { lg: 4, md: 2, sm: 1, xs: 1, xxs: 1 }}
      breakpoints={breakpoints || { lg: 1200, md: 900, sm: 640, xs: 480, xxs: 0 }}
      rowHeight={rowHeight}
      isDraggable={isDraggable}
      isResizable={isResizable}
      margin={margin}
      containerPadding={[0, 0]}
      draggableHandle=".lf-grid-item__handle"
    >
      {children}
    </ResponsiveGrid>
  )
}

export default WorkspaceGrid
