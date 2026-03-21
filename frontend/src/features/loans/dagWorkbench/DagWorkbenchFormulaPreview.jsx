import React from 'react';

function DagWorkbenchFormulaPreview({ formula, renderFormula, loading, error, emptyLabel }) {
  if (!formula.trim()) {
    return <div className="loans-dag-workbench__formula-empty">{emptyLabel}</div>;
  }

  if (loading) {
    return <div className="loans-dag-workbench__formula-empty">Loading formula preview...</div>;
  }

  if (error) {
    return <div className="inline-message inline-message--error">{error}</div>;
  }

  try {
    const markup = renderFormula ? renderFormula(formula) : formula;

    return (
      <div
        className="loans-dag-workbench__formula-preview"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    );
  } catch (renderError) {
    return <div className="inline-message inline-message--error">{renderError.message}</div>;
  }
}

export default DagWorkbenchFormulaPreview;
