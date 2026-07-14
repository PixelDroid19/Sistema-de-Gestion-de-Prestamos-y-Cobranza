import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync('src/index.css', 'utf8');

describe('associate frequency segmented control styles', () => {
  it('uses the shared outer border without drawing a second border around the selected segment', () => {
    const selectedRule = styles.match(/\.associate-frequency__option--selected\s*\{([^}]*)\}/)?.[1];

    expect(selectedRule).toBeDefined();
    expect(selectedRule).not.toMatch(/box-shadow/);
  });

  it('keeps keyboard focus visible without outlining an individual segment', () => {
    const focusRule = styles.match(/\.associate-frequency__option:focus-within\s*\{([^}]*)\}/)?.[1];

    expect(focusRule).toBeDefined();
    expect(focusRule).not.toMatch(/outline/);
    expect(focusRule).toMatch(/box-shadow:\s*inset 0 -2px/);
  });
});
