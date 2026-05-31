import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { driver } from 'driver.js';
import { startViewGuide } from '../guidedTours';

vi.mock('driver.js', () => ({
  driver: vi.fn(() => ({
    drive: vi.fn(),
  })),
}));

const guidedToursSource = () => readFileSync(join(process.cwd(), 'src/lib/guidedTours.ts'), 'utf8');

describe('guidedTours backoffice contract', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('does not reserve guide variants for customer or socio login roles', () => {
    const source = guidedToursSource();

    expect(source).toContain("export type GuideRole = 'admin' | 'employee'");
    expect(source).not.toContain("'customer' | 'socio'");
    expect(source).not.toContain('customer?: GuideProducer');
    expect(source).not.toContain('socio?: GuideProducer');
  });

  it('does not expose raw entity numbers in guide descriptions', () => {
    const source = guidedToursSource();

    expect(source).not.toMatch(/cr[eé]dito #/i);
    expect(source).not.toMatch(/#\$\{/);
  });

  it('keeps tour navigation button copy in terminology dictionaries', () => {
    const source = guidedToursSource();

    expect(source).not.toContain("nextBtnText: 'Siguiente'");
    expect(source).not.toContain("prevBtnText: 'Anterior'");
    expect(source).not.toContain("doneBtnText: 'Terminar'");
  });

  it('keeps guide step titles and descriptions in terminology dictionaries', () => {
    const source = guidedToursSource();

    expect(source).toContain('titleKey');
    expect(source).toContain('descriptionKey');
    expect(source).not.toMatch(/\btitle:\s*'[^']+'/);
    expect(source).not.toMatch(/\bdescription:\s*'[^']+'/);
  });

  it('resolves guide step copy from the active locale', () => {
    window.localStorage.setItem('app.locale', 'en');
    document.body.innerHTML = '<main data-tour="dashboard-page"></main>';

    startViewGuide('dashboard');

    const config = vi.mocked(driver).mock.calls[0]?.[0] as { steps?: Array<{ popover?: { title?: string; description?: string } }> };
    expect(config.steps?.[0]?.popover?.title).toBe('Dashboard');
    expect(config.steps?.[0]?.popover?.description).toBe(
      'Summarizes portfolio, delinquency, and recent activity to start the daily operation.',
    );
  });
});
