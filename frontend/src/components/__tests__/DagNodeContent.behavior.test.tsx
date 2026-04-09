import { render, screen } from '@testing-library/react';
import DagNodeContent from '../dag/DagNodeContent';
import { tTerm } from '../../i18n/terminology';

describe('DagNodeContent UX behavior', () => {
  it('renders concise card content with business summary and formula indicator', () => {
    render(
      <DagNodeContent
        kind="formula"
        label="Interés Devengado"
        description="Interés acumulado pendiente de pago"
        formula="outstandingPrincipal * monthlyRate"
      />,
    );

    expect(screen.getByText('Interés acumulado pendiente de pago')).toBeInTheDocument();
    expect(screen.getByText(tTerm('dag.node.formulaIndicator.available'))).toBeInTheDocument();
    expect(screen.queryByText(tTerm('dag.node.businessMeaning'))).not.toBeInTheDocument();
    expect(screen.queryByText(tTerm('dag.node.keyTerms'))).not.toBeInTheDocument();
    expect(screen.queryByText(tTerm('dag.node.variables'))).not.toBeInTheDocument();
  });

  it('falls back to concise summary when business description is missing', () => {
    render(
      <DagNodeContent
        kind="formula"
        label="Distribución del Pago"
        description=""
        formula="allocatePayment({ paymentAmount, interestDue, outstandingPrincipal })"
      />,
    );

    expect(screen.getByText(tTerm('dag.node.summary.paymentAllocation'))).toBeInTheDocument();
    expect(screen.getByText(tTerm('dag.node.formulaIndicator.available'))).toBeInTheDocument();
  });

  it('shows missing formula indicator for formula node without expression', () => {
    render(
      <DagNodeContent
        kind="formula"
        label="Fórmula vacía"
        description=""
        formula=""
      />,
    );

    expect(screen.getByText(tTerm('dag.node.formulaIndicator.missing'))).toBeInTheDocument();
  });
});
