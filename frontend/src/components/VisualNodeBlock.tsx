import React from 'react';
import type { DagNode, DagEdge, NodeKind } from '../types/dag';

// Domain helpers that should be rendered as opaque blocks, not formula text.
const DOMAIN_HELPERS = new Set([
  'buildAmortizationSchedule',
  'summarizeSchedule',
  'buildSimulationResult',
  'assertSupportedLateFeeMode',
  'calculateLateFee',
  'roundCurrency',
]);

function isDomainHelperFormula(formula: string): boolean {
  if (!formula) return false;
  const match = formula.match(/^(\w+)\s*\(/);
  return match ? DOMAIN_HELPERS.has(match[1]) : false;
}

function splitTopLevel(str: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of str) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === delimiter && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Parse a formula into a tree of visual blocks
type BlockType = 'variable' | 'value' | 'operator' | 'function' | 'if' | 'elseIf' | 'then' | 'else';

interface BlockNode {
  type: BlockType;
  text: string;
  children?: BlockNode[];
}

function parseToBlocks(formula: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < formula.length) {
    const char = formula[i];

    // Skip whitespace
    if (/\s/.test(char)) { i++; continue; }

    // Number
    const numMatch = formula.slice(i).match(/^(\d+\.?\d*)/);
    if (numMatch) {
      blocks.push({ type: 'value', text: numMatch[1] });
      i += numMatch[1].length;
      continue;
    }

    // Word (variable or function)
    const wordMatch = formula.slice(i).match(/^(\w+)/);
    if (wordMatch) {
      const word = wordMatch[1];
      i += word.length;
      while (i < formula.length && /\s/.test(formula[i])) i++;

      if (i < formula.length && formula[i] === '(') {
        // Function call
        i++; // skip (
        let depth = 1;
        let argsStr = '';
        while (i < formula.length && depth > 0) {
          if (formula[i] === '(') depth++;
          if (formula[i] === ')') depth--;
          if (depth > 0) argsStr += formula[i];
          i++;
        }
        const argParts = splitTopLevel(argsStr, ',');
        blocks.push({
          type: 'function',
          text: word,
          children: argParts.map((arg) => ({
            type: 'value',
            text: arg.trim(),
            children: parseToBlocks(arg.trim()),
          })),
        });
      } else {
        blocks.push({ type: 'variable', text: word });
      }
      continue;
    }

    // Operators
    const twoChar = formula.slice(i, i + 2);
    if (twoChar === '>=' || twoChar === '<=' || twoChar === '!=' || twoChar === '==') {
      blocks.push({ type: 'operator', text: twoChar });
      i += 2;
      continue;
    }

    if (/[><=+\-*/]/.test(char)) {
      blocks.push({ type: 'operator', text: char });
      i++;
      continue;
    }

    i++; // skip unknown
  }

  return blocks;
}

function parseIfThenElseBlocks(formula: string): { condition: BlockNode[]; thenValue: BlockNode[]; elseValue: BlockNode[] } | null {
  const ifMatch = formula.match(/^if(?:ThenElse)?\((.*)\)$/i);
  if (!ifMatch) return null;

  const inner = ifMatch[1];
  const parts = splitTopLevel(inner, ',');
  if (parts.length < 3) return null;

  return {
    condition: parseToBlocks(parts[0]),
    thenValue: parseToBlocks(parts[1]),
    elseValue: parseToBlocks(parts[2]),
  };
}

// ── Visual Block Components ──

function VariableChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
      {text}
    </span>
  );
}

function ValueChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 border border-green-200 text-green-700 text-xs font-mono font-medium">
      {text}
    </span>
  );
}

function OperatorChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-1 rounded-md bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold">
      {text}
    </span>
  );
}

function FunctionChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold uppercase">
      {text}
    </span>
  );
}

function KeywordChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase">
      {text}
    </span>
  );
}

function renderBlockNode(node: BlockNode): React.ReactNode {
  switch (node.type) {
    case 'variable':
      return <VariableChip key={node.text} text={node.text} />;
    case 'value':
      return <ValueChip key={node.text} text={node.text} />;
    case 'operator':
      return <OperatorChip key={node.text} text={node.text} />;
    case 'function':
      return (
        <span key={node.text} className="inline-flex items-center gap-1">
          <FunctionChip text={node.text} />
          <span className="text-gray-400">(</span>
          {node.children?.map((child, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-gray-400">, </span>}
              {child.children ? child.children.map((c, i) => <React.Fragment key={i}>{renderBlockNode(c)}</React.Fragment>) : renderBlockNode(child)}
            </React.Fragment>
          ))}
          <span className="text-gray-400">)</span>
        </span>
      );
    default:
      return null;
  }
}

function renderBlockRow(blocks: BlockNode[]): React.ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {blocks.map((block, idx) => (
        <React.Fragment key={idx}>{renderBlockNode(block)}</React.Fragment>
      ))}
    </div>
  );
}

// ── Node Type Colors ──
const nodeStyles: Record<NodeKind, { bg: string; border: string; headerBg: string; text: string }> = {
  constant: { bg: '#f8f9ff', border: '#90caf9', headerBg: '#e3f2fd', text: '#0d47a1' },
  formula: { bg: '#ffffff', border: '#ffe082', headerBg: '#fff8e1', text: '#5d4037' },
  conditional: { bg: '#ffffff', border: '#ce93d8', headerBg: '#f3e5f5', text: '#4a148c' },
  output: { bg: '#f8f9ff', border: '#a5d6a7', headerBg: '#e8f5e9', text: '#1b5e20' },
  lookup: { bg: '#f8f9ff', border: '#f48fb1', headerBg: '#fce4ec', text: '#880e4f' },
};

// ── Visual Node Block ──
interface VisualNodeBlockProps {
  node: DagNode;
  edges: DagEdge[];
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onEdgeHandleClick: (nodeId: string, side: 'in' | 'out', e: React.MouseEvent) => void;
}

export function VisualNodeBlock({
  node,
  edges,
  isSelected,
  onSelect,
  onDelete,
  onDragStart,
  onEdgeHandleClick,
}: VisualNodeBlockProps) {
  const incoming = edges.filter((e) => e.target === node.id);
  const outgoing = edges.filter((e) => e.source === node.id);
  const style = nodeStyles[node.kind];

  const formula = node.formula || '';
  const ifData = parseIfThenElseBlocks(formula);
  const blocks = ifData ? null : parseToBlocks(formula);

  return (
    <div
      className={`absolute rounded-xl border-2 shadow-sm cursor-default select-none transition-all ${isSelected ? 'ring-2 ring-offset-2 ring-[#00668a] shadow-lg' : 'hover:shadow-md'}`}
      style={{
        left: node.x ?? 0,
        top: node.y ?? 0,
        width: ifData ? 440 : 340,
        backgroundColor: style.bg,
        borderColor: isSelected ? '#00668a' : style.border,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t-xl cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: style.headerBg }}
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ backgroundColor: style.border, color: '#ffffff' }}
          >
            {node.kind === 'constant' ? 'CONSTANTE' : node.kind === 'formula' ? 'FÓRMULA' : node.kind === 'conditional' ? 'CONDICIONAL' : node.kind === 'output' ? 'OUTPUT' : 'LOOKUP'}
          </span>
          <span className="text-sm font-semibold truncate" style={{ color: style.text }}>
            {node.label || node.id}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="text-[#5a6271] hover:text-[#ba1a1a] transition-colors p-0.5 shrink-0"
          title="Eliminar nodo"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        {/* Domain helpers render as opaque blocks */}
        {isDomainHelperFormula(formula) ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: '#5a6271' }}>
            <span className="w-2 h-2 rounded-full bg-[#ffa726]" />
            <span className="italic">Bloque de dominio</span>
            {incoming.length > 0 && (
              <span className="text-[10px] opacity-70">· {incoming.length} entrada{incoming.length > 1 ? 's' : ''}</span>
            )}
          </div>
        ) : ifData ? (
          /* ifThenElse visual blocks */
          <div className="flex flex-col gap-3">
            {/* IF block */}
            <div className="flex flex-wrap items-center gap-1.5 bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2">
              <KeywordChip text="IF" />
              {renderBlockRow(ifData.condition)}
              <KeywordChip text="THEN" />
              {renderBlockRow(ifData.thenValue)}
            </div>
            {/* ELSE block */}
            <div className="flex flex-wrap items-center gap-1.5 bg-orange-50/50 border border-orange-100 rounded-lg px-3 py-2">
              <KeywordChip text="ELSE" />
              {renderBlockRow(ifData.elseValue)}
            </div>
          </div>
        ) : blocks && blocks.length > 0 ? (
          /* Plain formula as visual blocks */
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-50/50 border border-gray-100 rounded-lg px-3 py-2">
            {renderBlockRow(blocks)}
          </div>
        ) : node.kind === 'constant' ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: '#5a6271' }}>
            <span className="w-2 h-2 rounded-full bg-[#42a5f5]" />
            Variable: <span className="font-mono font-medium">{node.outputVar}</span>
          </div>
        ) : null}

        {/* OutputVar badge */}
        {node.outputVar && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#5a6271' }}>
              Output:
            </span>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
              style={{ backgroundColor: style.headerBg, borderColor: style.border, color: style.text }}
            >
              {node.outputVar}
            </span>
          </div>
        )}
      </div>

      {/* Edge count badge */}
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] text-[#5a6271] whitespace-nowrap">
        {incoming.length > 0 && <span>{incoming.length} in</span>}
        {outgoing.length > 0 && <span>{outgoing.length} out</span>}
      </div>

      {/* Input handle (left) */}
      <button
        className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow hover:scale-125 transition-transform z-20"
        style={{ backgroundColor: style.border }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onEdgeHandleClick(node.id, 'in', e);
        }}
        title="Conectar entrada"
      />

      {/* Output handle (right) */}
      <button
        className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow hover:scale-125 transition-transform z-20"
        style={{ backgroundColor: style.border }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onEdgeHandleClick(node.id, 'out', e);
        }}
        title="Conectar salida"
      />
    </div>
  );
}
