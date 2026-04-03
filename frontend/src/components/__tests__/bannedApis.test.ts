import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';

const FRONTEND_SRC = join(import.meta.dirname, '..', '..');

const BANNED_PATTERNS = [
  { pattern: /window\.alert\s*\(/, name: 'window.alert' },
  { pattern: /window\.confirm\s*\(/, name: 'window.confirm' },
  { pattern: /window\.prompt\s*\(/, name: 'window.prompt' },
  { pattern: /[^a-zA-Z]confirm\s*\(/, name: 'confirm(' },
  { pattern: /[^a-zA-Z]prompt\s*\(/, name: 'prompt(' },
  { pattern: /<dialog/, name: '<dialog' },
  { pattern: /showModalDialog/, name: 'showModalDialog' },
];

const TSX_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

async function* getSourceFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'dist') continue;
      yield* getSourceFiles(fullPath);
    } else if (TSX_EXTENSIONS.includes(extname(entry.name))) {
      if (fullPath.includes(join('lib', 'confirmModal'))) continue;
      yield fullPath;
    }
  }
}

interface Violation {
  file: string;
  pattern: string;
  line: number;
}

async function findViolations(): Promise<Violation[]> {
  const violations: Violation[] = [];
  
  for await (const file of getSourceFiles(FRONTEND_SRC)) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');
    
    for (const { pattern, name } of BANNED_PATTERNS) {
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          violations.push({
            file: file.replace(FRONTEND_SRC, ''),
            pattern: name,
            line: index + 1,
          });
        }
      });
    }
  }
  
  return violations;
}

describe('Banned APIs audit', () => {
  it('should not use window.alert in frontend source', async () => {
    const violations = await findViolations();
    const alertViolations = violations.filter(v => v.pattern === 'window.alert');
    expect(alertViolations, 
      `Found window.alert usage at:\n${alertViolations.map(v => `  ${v.file}:${v.line}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('should not use window.confirm in frontend source', async () => {
    const violations = await findViolations();
    const confirmViolations = violations.filter(v => v.pattern === 'window.confirm');
    expect(confirmViolations, 
      `Found window.confirm usage at:\n${confirmViolations.map(v => `  ${v.file}:${v.line}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('should not use window.prompt in frontend source', async () => {
    const violations = await findViolations();
    const promptViolations = violations.filter(v => v.pattern === 'window.prompt');
    expect(promptViolations, 
      `Found window.prompt usage at:\n${promptViolations.map(v => `  ${v.file}:${v.line}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('should not use bare confirm() in frontend source', async () => {
    const violations = await findViolations();
    const bareConfirmViolations = violations.filter(v => v.pattern === 'confirm(');
    expect(bareConfirmViolations, 
      `Found bare confirm() usage at:\n${bareConfirmViolations.map(v => `  ${v.file}:${v.line}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('should not use bare prompt() in frontend source', async () => {
    const violations = await findViolations();
    const barePromptViolations = violations.filter(v => v.pattern === 'prompt(');
    expect(barePromptViolations, 
      `Found bare prompt() usage at:\n${barePromptViolations.map(v => `  ${v.file}:${v.line}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('should not use <dialog> element in frontend source', async () => {
    const violations = await findViolations();
    const dialogViolations = violations.filter(v => v.pattern === '<dialog');
    expect(dialogViolations, 
      `Found <dialog> usage at:\n${dialogViolations.map(v => `  ${v.file}:${v.line}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('should not use showModalDialog in frontend source', async () => {
    const violations = await findViolations();
    const showModalDialogViolations = violations.filter(v => v.pattern === 'showModalDialog');
    expect(showModalDialogViolations, 
      `Found showModalDialog usage at:\n${showModalDialogViolations.map(v => `  ${v.file}:${v.line}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('should have zero banned API violations in total', async () => {
    const violations = await findViolations();
    expect(violations, 
      `Found ${violations.length} banned API violation(s):\n${violations.map(v => `  ${v.file}:${v.line} (${v.pattern})`).join('\n')}`
    ).toHaveLength(0);
  });
});

describe('confirmModal library', () => {
  it('should export confirm function', async () => {
    const { confirm } = await import('../../lib/confirmModal');
    expect(typeof confirm).toBe('function');
  });

  it('should export confirmDanger function', async () => {
    const { confirmDanger } = await import('../../lib/confirmModal');
    expect(typeof confirmDanger).toBe('function');
  });

  it('should export requestInput function', async () => {
    const { requestInput } = await import('../../lib/confirmModal');
    expect(typeof requestInput).toBe('function');
  });

  it('should export useConfirm hook', async () => {
    const { useConfirm } = await import('../../lib/confirmModal');
    expect(typeof useConfirm).toBe('function');
  });
});
