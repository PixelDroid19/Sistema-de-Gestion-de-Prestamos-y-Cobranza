import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync('src/index.css', 'utf8');

describe('associate frequency segmented control styles', () => {
  it('gives normal, hover, active, and selected states distinct visual treatments', () => {
    const optionRule = styles.match(/\.associate-frequency__option\s*\{([^}]*)\}/)?.[1];
    const hoverRule = styles.match(/\.associate-frequency__option:not\(\.associate-frequency__option--selected\):hover\s*\{([^}]*)\}/)?.[1];
    const activeRule = styles.match(/\.associate-frequency__option:active\s*\{([^}]*)\}/)?.[1];
    const selectedRule = styles.match(/\.associate-frequency__option--selected\s*\{([^}]*)\}/)?.[1];

    expect(optionRule).toMatch(/transition:/);
    expect(hoverRule).toMatch(/background:/);
    expect(activeRule).toMatch(/transform:\s*translateY\(1px\)/);
    expect(selectedRule).toBeDefined();
    expect(selectedRule).toMatch(/background:/);
    expect(selectedRule).toMatch(/box-shadow:\s*inset/);
  });

  it('draws a complete keyboard focus ring around the focused segment', () => {
    const focusRule = styles.match(/\.associate-frequency__option:focus-within\s*\{([^}]*)\}/)?.[1];

    expect(focusRule).toBeDefined();
    expect(focusRule).toMatch(/outline:\s*2px solid/);
    expect(focusRule).toMatch(/outline-offset:\s*-2px/);
  });
});
