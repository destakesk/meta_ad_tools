import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>connected</Badge>);
    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('applies variant className', () => {
    render(<Badge variant="success">ok</Badge>);
    const el = screen.getByText('ok');
    expect(el.className).toContain('--success');
  });
});
