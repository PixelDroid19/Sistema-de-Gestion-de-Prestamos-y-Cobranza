import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync('src/index.css', 'utf8');

describe('shared table footer styles', () => {
  it('styles semantic footer headers with the same separator, spacing, background, and corners as data cells', () => {
    expect(styles).toMatch(/table tfoot tr :is\(th, td\):first-child/);
    expect(styles).toMatch(/table tfoot tr :is\(th, td\):last-child/);
    expect(styles).toMatch(/table tfoot :is\(th, td\)/);
  });
});
