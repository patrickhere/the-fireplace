import { render, screen } from '@testing-library/react';

import { StatusDot } from '@/components/atoms/StatusDot';
import { StatusPill } from '@/components/atoms/StatusPill';
import { ModelBadge } from '@/components/atoms/ModelBadge';

describe('StatusPill', () => {
  it('maps connected to success styling', () => {
    render(<StatusPill status="connected" />);
    expect(screen.getByText('Connected')).toHaveClass('bg-emerald-500/20');
  });

  it('maps error to danger styling', () => {
    render(<StatusPill status="error" />);
    expect(screen.getByText('Error')).toHaveClass('bg-red-500/20');
  });
});

describe('StatusDot', () => {
  it('renders expected color class and pulse', () => {
    const { container } = render(<StatusDot status="warning" pulse />);
    const dot = container.firstChild;
    expect(dot).toHaveClass('bg-amber-500');
    expect(dot).toHaveClass('animate-pulse');
  });
});

describe('ModelBadge', () => {
  it('renders compact model label and tier styling', () => {
    render(<ModelBadge model="copilot-free/gpt-4.1" />);
    expect(screen.getByText('gpt-4.1')).toHaveClass('bg-emerald-500/20');
  });
});
