import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const authServiceSource = () => readFileSync(join(process.cwd(), 'src/services/authService.ts'), 'utf8');

describe('authService backoffice contract', () => {
  it('does not expose the retired public registration endpoint', () => {
    const source = authServiceSource();

    expect(source).not.toContain("apiClient.post('/auth/register'");
    expect(source).not.toContain('registerMutation');
  });
});
