import React, { useEffect, useMemo, useRef, useState } from 'react';
import DagNodeContent from './DagNodeContent';
import { tTerm } from '../../i18n/terminology';
import { FORMULA_HELPERS } from '../../types/dag';

type FormulaNodeEditorProps = {
  nodeId: string;
  label?: string;
  description?: string;
  formula?: string;
  /** outputVar names from all upstream (ancestor) nodes — used for variable chips */
  upstreamVars?: string[];
  onCommit: (id: string, data: { description: string; formula: string }) => void;
};

const ALLOWED_FORMULA_CHARS = /^[A-Za-z0-9_\s.+\-*/%^(),:{}[\]<>!=&|?'"\n\r\t]*$/;

const BLOCKED_FORMULA_PATTERNS = [
  /import\s*\(/i,
  /evaluate\s*\(/i,
  /parse\s*\(/i,
  /createUnit\s*\(/i,
  /simplify\s*\(/i,
  /derivative\s*\(/i,
  /chain\s*\(/i,
  /typed\s*\(/i,
  /config\s*\(/i,
  /importFrom\s*\(/i,
];

const ALLOWED_FORMULA_FUNCTIONS = new Set([
  'add',
  'subtract',
  'multiply',
  'divide',
  'mod',
  'pow',
  'abs',
  'ceil',
  'floor',
  'round',
  'sqrt',
  'log',
  'exp',
  'max',
  'min',
  'mean',
  'median',
  'format',
  'conj',
  're',
  'im',
  'fix',
  'gamma',
  'assertSupportedLateFeeMode',
  'calculateLateFee',
  'buildAmortizationSchedule',
  'summarizeSchedule',
  'roundCurrency',
  'buildSimulationResult',
]);

const ALLOWED_FUNCTION_LIST = [...ALLOWED_FORMULA_FUNCTIONS].sort();

const getDisallowedFunctions = (formulaDraft: string): string[] => {
  const functions: string[] = [];
  const functionPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  let match: RegExpExecArray | null = null;
  while ((match = functionPattern.exec(formulaDraft)) !== null) {
    functions.push(match[1]);
  }

  return functions.filter((fn) => !ALLOWED_FORMULA_FUNCTIONS.has(fn));
};

const hasBalancedDelimiters = (value: string): boolean => {
  const opening = new Set(['(', '{', '[']);
  const pairMap: Record<string, string> = {
    ')': '(',
    '}': '{',
    ']': '[',
  };
  const stack: string[] = [];

  for (const char of value) {
    if (opening.has(char)) {
      stack.push(char);
      continue;
    }

    if (pairMap[char]) {
      const top = stack.pop();
      if (top !== pairMap[char]) return false;
    }
  }

  return stack.length === 0;
};

const validateFormulaDraft = (formulaDraft: string) => {
  if (!formulaDraft.trim()) {
    return {
      valid: false,
      messageKey: 'dag.nodeEdit.formula.validation.required' as const,
    };
  }

  if (!ALLOWED_FORMULA_CHARS.test(formulaDraft)) {
    return {
      valid: false,
      messageKey: 'dag.nodeEdit.formula.validation.invalidCharacters' as const,
    };
  }

  if (BLOCKED_FORMULA_PATTERNS.some((pattern) => pattern.test(formulaDraft))) {
    return {
      valid: false,
      messageKey: 'dag.nodeEdit.formula.validation.blockedPattern' as const,
    };
  }

  if (!hasBalancedDelimiters(formulaDraft)) {
    return {
      valid: false,
      messageKey: 'dag.nodeEdit.formula.validation.unbalancedParentheses' as const,
    };
  }

  const disallowedFunctions = getDisallowedFunctions(formulaDraft);
  if (disallowedFunctions.length > 0) {
    return {
      valid: false,
      messageKey: 'dag.nodeEdit.formula.validation.disallowedFunction' as const,
    };
  }

  return {
    valid: true,
    messageKey: 'dag.nodeEdit.formula.validation.ok' as const,
  };
};

export const FormulaNodeEditor: React.FC<FormulaNodeEditorProps> = ({
  nodeId,
  label,
  description,
  formula,
  upstreamVars = [],
  onCommit,
}) => {
  const businessDescriptionId = `formula-business-${nodeId}`;
  const technicalFormulaId = `formula-technical-${nodeId}`;
  const [businessDraft, setBusinessDraft] = useState(description || '');
  const [formulaDraft, setFormulaDraft] = useState(formula || '');
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const formulaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setBusinessDraft(description || '');
    setFormulaDraft(formula || '');
    setShowAdvancedDetails(false);
  }, [nodeId, description, formula]);

  const validation = useMemo(() => validateFormulaDraft(formulaDraft), [formulaDraft]);

  const hasChanges = businessDraft !== (description || '') || formulaDraft !== (formula || '');

  /** Insert text at the cursor position in the formula textarea */
  const insertAtCursor = (text: string) => {
    const textarea = formulaRef.current;
    if (!textarea) {
      setFormulaDraft((prev) => prev + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = formulaDraft.slice(0, start);
    const after = formulaDraft.slice(end);
    const next = before + text + after;
    setFormulaDraft(next);
    // Restore cursor after the inserted text
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = start + text.length;
      textarea.selectionEnd = start + text.length;
    });
  };

  const handleCommit = () => {
    if (!validation.valid) return;
    onCommit(nodeId, {
      description: businessDraft,
      formula: formulaDraft,
    });
  };

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-semibold text-text-primary">{tTerm('dag.nodeEdit.formula.title')}</p>

      <div>
        <label htmlFor={businessDescriptionId} className="block text-[10px] text-text-secondary mb-1">
          {tTerm('dag.nodeEdit.formula.businessLabel')}
        </label>
        <textarea
          id={businessDescriptionId}
          value={businessDraft}
          onChange={(event) => setBusinessDraft(event.target.value)}
          rows={2}
          className="w-full text-xs px-2 py-1.5 rounded border resize-none bg-bg-base border-border-subtle text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder={tTerm('dag.nodeEdit.formula.businessPlaceholder')}
        />
      </div>

      {/* ── Helper chips ──────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] text-text-secondary mb-1">Helpers disponibles</p>
        <div className="flex flex-wrap gap-1">
          {FORMULA_HELPERS.map((helper) => (
            <button
              key={helper.name}
              type="button"
              title={helper.description}
              onClick={() => insertAtCursor(`${helper.name}()`)}
              className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
            >
              {helper.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Upstream variable chips ───────────────────────────────── */}
      {upstreamVars.length > 0 && (
        <div>
          <p className="text-[10px] text-text-secondary mb-1">Variables disponibles</p>
          <div className="flex flex-wrap gap-1">
            {upstreamVars.map((varName) => (
              <button
                key={varName}
                type="button"
                onClick={() => insertAtCursor(varName)}
                className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-800/40 transition-colors"
              >
                {varName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label htmlFor={technicalFormulaId} className="block text-[10px] text-text-secondary mb-1">
          {tTerm('dag.nodeEdit.formula.technicalLabel')}
        </label>
        <p className="text-[9px] text-text-secondary mb-1.5">{tTerm('dag.nodeEdit.formula.quickHelp')}</p>
        <textarea
          ref={formulaRef}
          id={technicalFormulaId}
          value={formulaDraft}
          onChange={(event) => setFormulaDraft(event.target.value)}
          rows={4}
          className="w-full text-[10px] font-mono px-2 py-1.5 rounded border resize-none bg-bg-base border-border-subtle text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder={tTerm('dag.nodeEdit.formula.technicalPlaceholder')}
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvancedDetails((previous) => !previous)}
          className="text-[10px] font-medium text-blue-500 hover:text-blue-600"
        >
          {showAdvancedDetails
            ? tTerm('dag.nodeEdit.formula.advancedToggle.hide')
            : tTerm('dag.nodeEdit.formula.advancedToggle.show')}
        </button>
      </div>

      {showAdvancedDetails && (
        <div>
          <div className="mt-1.5 text-[9px] text-text-secondary space-y-1">
            <p>{tTerm('dag.nodeEdit.formula.technicalHelper')}</p>
            <p>{tTerm('dag.nodeEdit.formula.allowedHelpersLabel')}</p>
            <p className="font-mono break-all">
              {ALLOWED_FUNCTION_LIST.join(', ')}
            </p>
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold text-text-primary mb-1">{tTerm('dag.nodeEdit.formula.previewLabel')}</p>
        <div className="rounded border border-border-subtle bg-bg-base">
          {formulaDraft.trim() ? (
            <DagNodeContent
              kind="formula"
              label={label}
              description={businessDraft}
              formula={formulaDraft}
            />
          ) : (
            <p className="text-[10px] text-text-secondary px-3 py-2">
              {tTerm('dag.nodeEdit.formula.previewEmpty')}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <p
          className={`text-[10px] ${validation.valid ? 'text-emerald-500' : 'text-red-500'}`}
          role="status"
        >
          {tTerm(validation.messageKey)}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCommit}
            disabled={!hasChanges || !validation.valid}
            className="px-2.5 py-1 text-[10px] rounded bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tTerm('dag.nodeEdit.formula.apply')}
          </button>
          <button
            type="button"
            onClick={() => {
              setBusinessDraft(description || '');
              setFormulaDraft(formula || '');
            }}
            disabled={!hasChanges}
            className="px-2.5 py-1 text-[10px] rounded border border-border-subtle text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tTerm('dag.nodeEdit.formula.reset')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormulaNodeEditor;
