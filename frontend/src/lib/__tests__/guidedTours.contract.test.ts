import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const guidedToursSource = () => readFileSync(join(process.cwd(), 'src/lib/guidedTours.ts'), 'utf8');

describe('guidedTours backoffice contract', () => {
  it('does not reserve guide variants for customer or socio login roles', () => {
    const source = guidedToursSource();

    expect(source).toContain("export type GuideRole = 'admin' | 'employee'");
    expect(source).not.toContain("'customer' | 'socio'");
    expect(source).not.toContain('customer?: GuideProducer');
    expect(source).not.toContain('socio?: GuideProducer');
  });
});
