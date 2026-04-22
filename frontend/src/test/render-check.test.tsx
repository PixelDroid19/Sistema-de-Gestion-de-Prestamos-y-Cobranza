import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('render test', () => {
  it('can render', () => {
    render(<div>Hello</div>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
