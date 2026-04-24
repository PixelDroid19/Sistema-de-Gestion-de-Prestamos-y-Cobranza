// frontend/src/components/LogicBlock.tsx
//
// Visual block component for the formula editor canvas.
// Renders IF/THEN/ELSE, expression, and output blocks as
// horizontal chip rows (matching the CreditCore Engine mockup).

import React from 'react';
import { GitBranch, Plus } from 'lucide-react';
import type { BlockDefinition, BlockCondition, BlockKind } from '../types/dag';
import {
  getFormulaTargetLabel,
  getFormulaValueLabel,
  getFormulaVariableLabel,
} from '../lib/formulaDisplay';
import { findCreditFormulaTemplate, getFormulaFromBlock } from '../lib/creditFormulaTemplates';

// ── Color Tokens ──────────────────────────────────────────────────────────────

const COLORS = {
  // Keyword chips (IF, THEN, ELSE, AND)
  keyword: {
    bg: '#e2dfff',
    border: '#c3c0ff',
    text: '#0f0069',
  },
  // Variable chips
  variable: {
    bg: '#dce9ff',
    border: '#bec6e0',
    text: '#131b2e',
    dot: '#40c2fd',
  },
  // Operator chips
  operator: {
    bg: '#f8f9ff',
    border: '#c6c6cd',
    text: '#0b1c30',
  },
  // Value chips
  value: {
    bg: '#ffffff',
    border: '#c6c6cd',
    text: '#00668a',
  },
  // Output block
  output: {
    bg: '#ffffff',
    border: '#40c2fd',
    text: '#0b1c30',
  },
  // Container borders
  block: {
    bg: '#ffffff',
    border: '#c6c6cd',
    activeBorder: '#00668a',
  },
  // Connector line
  connector: '#c6c6cd',
} as const;

// ── Chip Components ───────────────────────────────────────────────────────────

function KeywordChip({ text }: { text: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '4px',
        backgroundColor: COLORS.keyword.bg,
        border: `1px solid ${COLORS.keyword.border}`,
        color: COLORS.keyword.text,
        fontSize: '12px',
        fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '0.02em',
      }}
    >
      {text}
    </span>
  );
}

function VariableChip({ name }: { name: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '4px',
        backgroundColor: COLORS.variable.bg,
        border: `1px solid ${COLORS.variable.border}`,
        color: COLORS.variable.text,
        fontSize: '12px',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: COLORS.variable.dot,
          flexShrink: 0,
        }}
      />
      {getFormulaVariableLabel(name)}
    </span>
  );
}

function OperatorChip({ op }: { op: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '4px',
        backgroundColor: COLORS.operator.bg,
        border: `1px solid ${COLORS.operator.border}`,
        color: COLORS.operator.text,
        fontSize: '12px',
        fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {op}
    </span>
  );
}

function ValueChip({ value, outputVar }: { value: string; outputVar?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '4px',
        backgroundColor: COLORS.value.bg,
        border: `1px solid ${COLORS.value.border}`,
        color: COLORS.value.text,
        fontSize: '12px',
        fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      {getFormulaValueLabel(value, outputVar)}
    </span>
  );
}

// ── Condition Row ─────────────────────────────────────────────────────────────

function ConditionRow({ condition }: { condition: BlockCondition }) {
  return (
    <>
      <VariableChip name={condition.variable} />
      <OperatorChip op={condition.operator} />
      <ValueChip value={condition.value} />
    </>
  );
}

// ── Block Row Components ──────────────────────────────────────────────────────

function IfBlockRow({
  block,
  isSelected,
  onSelect,
  onDelete,
  outputVar,
}: {
  block: BlockDefinition;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  outputVar?: string;
}) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '8px',
        border: `1px solid ${isSelected ? COLORS.block.activeBorder : COLORS.block.border}`,
        backgroundColor: COLORS.block.bg,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: isSelected ? `0 0 0 2px ${COLORS.block.activeBorder}30` : 'none',
        position: 'relative',
      }}
    >
      <KeywordChip text={block.kind === 'if' ? 'IF' : 'ELSE IF'} />
      {block.condition && <ConditionRow condition={block.condition} />}
      <KeywordChip text="THEN" />
      <ValueChip value={block.thenValue || '0'} outputVar={outputVar} />
      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: '#ba1a1a',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            lineHeight: 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function ElseBlockRow({
  block,
  isSelected,
  onSelect,
  onDelete,
  outputVar,
}: {
  block: BlockDefinition;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  outputVar?: string;
}) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '8px',
        border: `1px solid ${isSelected ? COLORS.block.activeBorder : COLORS.block.border}`,
        backgroundColor: COLORS.block.bg,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: isSelected ? `0 0 0 2px ${COLORS.block.activeBorder}30` : 'none',
        position: 'relative',
      }}
    >
      <KeywordChip text="ELSE" />
      <ValueChip value={block.elseValue || '0'} outputVar={outputVar} />
      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: '#ba1a1a',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            lineHeight: 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function ExpressionBlockRow({
  block,
  isSelected,
  onSelect,
  onDelete,
  outputVar,
}: {
  block: BlockDefinition;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  outputVar?: string;
}) {
  const template = outputVar === 'calculationMethod' || outputVar === 'installmentAmount'
    ? findCreditFormulaTemplate(getFormulaFromBlock(block), block.templateKey)
    : null;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '8px',
        padding: '12px',
        borderRadius: '8px',
        border: `1px solid ${isSelected ? COLORS.block.activeBorder : '#dee1ea'}`,
        backgroundColor: template ? '#f0fdfa' : '#f8f9ff',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        position: 'relative',
      }}
    >
      {template ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>{template.name}</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4, marginTop: 3 }}>{template.useCase}</div>
            </div>
            {template.badge && (
              <span style={{ borderRadius: 999, background: '#dcfce7', color: '#166534', padding: '3px 7px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {template.badge}
              </span>
            )}
          </div>
          <div style={{ border: '1px solid #99f6e4', background: '#ffffff', color: '#0f766e', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
            {template.equation}
          </div>
        </>
      ) : (
        <span
          style={{
            fontSize: '12px',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#5a6271',
            fontStyle: 'italic',
            wordBreak: 'break-word',
          }}
        >
          {block.label || block.formula || 'Formula'}
        </span>
      )}
      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: '#ba1a1a',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Output Row ────────────────────────────────────────────────────────────────

function OutputRow({ outputVar }: { outputVar: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderTop: `1px dashed ${COLORS.connector}`,
        paddingTop: '16px',
        marginTop: '8px',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '6px 12px',
          borderRadius: '4px',
          backgroundColor: COLORS.output.bg,
          border: `2px solid ${COLORS.output.border}`,
          color: COLORS.output.text,
          fontSize: '14px',
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {getFormulaTargetLabel(outputVar)}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          color: COLORS.output.text,
        }}
      >
        =
      </span>
      <span
        style={{
          fontSize: '12px',
          fontFamily: "'JetBrains Mono', monospace",
          color: '#76777d',
          fontStyle: 'italic',
        }}
      >
        Resultado que usara el credito
      </span>
    </div>
  );
}

// ── Main LogicBlock Component ─────────────────────────────────────────────────

interface LogicBlockProps {
  block: BlockDefinition;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  outputVar?: string;
}

export function LogicBlock({ block, isSelected, onSelect, onDelete, outputVar }: LogicBlockProps) {
  switch (block.kind) {
    case 'if':
    case 'elseIf':
      return (
        <IfBlockRow
          block={block}
          isSelected={isSelected}
          onSelect={onSelect}
          onDelete={onDelete}
          outputVar={outputVar}
        />
      );
    case 'else':
      return (
        <ElseBlockRow
          block={block}
          isSelected={isSelected}
          onSelect={onSelect}
          onDelete={onDelete}
          outputVar={outputVar}
        />
      );
    case 'expression':
      return (
        <ExpressionBlockRow
          block={block}
          isSelected={isSelected}
          onSelect={onSelect}
          onDelete={onDelete}
          outputVar={outputVar}
        />
      );
    default:
      return null;
  }
}

// ── Formula Container Component ───────────────────────────────────────────────

interface FormulaContainerBlockProps {
  container: {
    id: string;
    label: string;
    blocks: BlockDefinition[];
    outputVar: string;
  };
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  onDeleteBlock: (containerId: string, blockId: string) => void;
  onSelectContainer: (containerId: string) => void;
  onAddBlock?: (containerId: string, kind: BlockKind) => void;
  isContainerSelected: boolean;
}

export function FormulaContainerBlock({
  container,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onSelectContainer,
  onAddBlock,
  isContainerSelected,
}: FormulaContainerBlockProps) {
  return (
    <div
      className="formula-container-block"
      onClick={(e) => { e.stopPropagation(); onSelectContainer(container.id); }}
      style={{
        backgroundColor: '#ffffff',
        border: `2px solid ${isContainerSelected ? '#00668a' : '#c6c6cd'}`,
        borderRadius: '12px',
        padding: '24px',
        boxShadow: isContainerSelected
          ? '0 4px 16px rgba(0,102,138,0.12)'
          : '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: 'min(100%, 520px)',
        position: 'relative',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        cursor: 'default',
      }}
    >
      {/* Container label */}
      <div
        style={{
          fontSize: '12px',
          fontFamily: "'JetBrains Mono', monospace",
          color: '#5a6271',
          marginBottom: '4px',
        }}
      >
        {container.label}
      </div>

      {/* Logic blocks */}
      {container.blocks.map((block, idx) => (
        <div key={block.id} style={{ position: 'relative' }}>
          {/* Connector line between blocks */}
          {idx > 0 && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '-16px',
                width: '2px',
                height: '16px',
                backgroundColor: COLORS.connector,
              }}
            />
          )}

          {/* Indent elseIf/else blocks */}
          <div style={{ marginLeft: block.kind === 'elseIf' || block.kind === 'else' ? '32px' : '0' }}>
            <LogicBlock
              block={block}
              isSelected={selectedBlockId === block.id}
              onSelect={() => onSelectBlock(block.id)}
              onDelete={() => onDeleteBlock(container.id, block.id)}
              outputVar={container.outputVar}
            />
          </div>
        </div>
      ))}

      {/* Empty state */}
      {container.blocks.length === 0 && (
        <div
          className="formula-rule-empty"
          style={{
            padding: '18px',
            border: '2px dashed #c6c6cd',
            borderRadius: '8px',
            textAlign: 'left',
            color: '#76777d',
            fontSize: '13px',
            background: '#f8fafc',
          }}
        >
          <div style={{ color: '#0f172a', fontWeight: 800, marginBottom: 6 }}>
            Esta etapa usa el valor del sistema.
          </div>
          <div style={{ lineHeight: 1.45, marginBottom: 12 }}>
            Agrega condiciones solo cuando necesites cambiar este valor para ciertos creditos.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAddBlock?.(container.id, 'if');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid #0f766e',
                background: '#0f766e',
                color: '#ffffff',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Agregar condicion
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAddBlock?.(container.id, 'else');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <GitBranch size={14} /> Valor alterno
            </button>
          </div>
        </div>
      )}

      {/* Output row */}
      <OutputRow outputVar={container.outputVar} />
    </div>
  );
}
