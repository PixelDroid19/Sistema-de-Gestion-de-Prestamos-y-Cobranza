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

  let markup = formula;
  let renderError = null;

  if (renderFormula) {
    try {
      markup = renderFormula(formula);
    } catch (errorValue) {
      renderError = errorValue;
    }
  }

  if (renderError) {
    return <div className="inline-message inline-message--error">{renderError.message}</div>;
  }

  return (
    <div
      className="loans-dag-workbench__formula-preview"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export default DagWorkbenchFormulaPreview;
