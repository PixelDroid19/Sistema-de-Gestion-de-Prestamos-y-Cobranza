import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickGuideButton } from '../HelpSupport';

vi.mock('../../../store/sessionStore', () => ({
  useSessionStore: () => ({
    user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.local' },
  }),
}));

vi.mock('../../../lib/guidedTours', () => ({
  hasGuideDefinition: () => true,
  startViewGuide: vi.fn(),
}));

describe('QuickGuideButton', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses translated copy instead of hardcoded Spanish text', () => {
    localStorage.setItem('app.locale', 'en');

    render(<QuickGuideButton guideKey="credits" />);

    expect(screen.getByRole('button', { name: 'Quick guide' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guía rápida' })).not.toBeInTheDocument();
  });
});
