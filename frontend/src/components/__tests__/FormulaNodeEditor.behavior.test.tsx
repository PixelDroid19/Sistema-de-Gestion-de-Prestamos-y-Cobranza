import { fireEvent, render, screen } from '@testing-library/react';
import FormulaNodeEditor from '../dag/FormulaNodeEditor';
import { tTerm } from '../../i18n/terminology';

describe('FormulaNodeEditor behavior', () => {
  it('shows technical formula editor by default and validates formula before apply', () => {
    const onCommit = vi.fn();

    render(
      <FormulaNodeEditor
        nodeId="formula_1"
        label="Interés"
        description="Descripción inicial"
        formula="outstandingPrincipal * monthlyRate"
        onCommit={onCommit}
      />,
    );

    expect(screen.getByRole('button', { name: tTerm('dag.nodeEdit.formula.advancedToggle.show') })).toBeInTheDocument();
    expect(screen.getByLabelText(tTerm('dag.nodeEdit.formula.technicalLabel'))).toBeInTheDocument();
    expect(screen.getByText(tTerm('dag.nodeEdit.formula.quickHelp'))).toBeInTheDocument();

    const technicalInput = screen.getByLabelText(tTerm('dag.nodeEdit.formula.technicalLabel'));
    fireEvent.change(technicalInput, { target: { value: 'outstandingPrincipal * (monthlyRate' } });

    expect(screen.getByText(tTerm('dag.nodeEdit.formula.validation.unbalancedParentheses'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: tTerm('dag.nodeEdit.formula.apply') }));
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.change(technicalInput, { target: { value: 'outstandingPrincipal * monthlyRate' } });
    fireEvent.change(screen.getByLabelText(tTerm('dag.nodeEdit.formula.businessLabel')), {
      target: { value: 'Interés causado del periodo' },
    });

    expect(screen.getByText(tTerm('dag.nodeEdit.formula.validation.ok'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: tTerm('dag.nodeEdit.formula.apply') }));

    expect(onCommit).toHaveBeenCalledWith('formula_1', {
      description: 'Interés causado del periodo',
      formula: 'outstandingPrincipal * monthlyRate',
    });
  });

  it('shows backend-aligned error when draft uses an unknown helper', () => {
    const onCommit = vi.fn();

    render(
      <FormulaNodeEditor
        nodeId="formula_2"
        label="Prueba"
        description=""
        formula="outstandingPrincipal * monthlyRate"
        onCommit={onCommit}
      />,
    );

    fireEvent.change(screen.getByLabelText(tTerm('dag.nodeEdit.formula.technicalLabel')), {
      target: { value: 'unsupportedHelper(outstandingPrincipal)' },
    });

    expect(screen.getByText(tTerm('dag.nodeEdit.formula.validation.disallowedFunction'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: tTerm('dag.nodeEdit.formula.apply') }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('accepts buildSimulationResult because it is allowed by the backend runtime', () => {
    const onCommit = vi.fn();

    render(
      <FormulaNodeEditor
        nodeId="formula_3"
        label="Resultado"
        description=""
        formula="buildSimulationResult(lateFeeMode, schedule, summary)"
        onCommit={onCommit}
      />,
    );

    expect(screen.getByText(tTerm('dag.nodeEdit.formula.validation.ok'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: tTerm('dag.nodeEdit.formula.apply') }));

    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(tTerm('dag.nodeEdit.formula.businessLabel')), {
      target: { value: 'Resultado final de la simulación' },
    });

    fireEvent.click(screen.getByRole('button', { name: tTerm('dag.nodeEdit.formula.apply') }));

    expect(onCommit).toHaveBeenCalledWith('formula_3', {
      description: 'Resultado final de la simulación',
      formula: 'buildSimulationResult(lateFeeMode, schedule, summary)',
    });
  });
});
