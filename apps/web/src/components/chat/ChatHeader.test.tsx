import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Zap } from 'lucide-react';
import { ChatHeader } from './ChatHeader';

describe('ChatHeader', () => {
  it('renders title', () => {
    render(<ChatHeader title="Zeus" icon={<Zap size={16} />} connected={true} onClose={vi.fn()} />);
    expect(screen.getByText('Zeus')).toBeDefined();
  });

  it('shows green dot when connected', () => {
    const { container } = render(<ChatHeader title="Chat" icon={<Zap size={16} />} connected={true} onClose={vi.fn()} />);
    const dot = container.querySelector('.bg-green-500');
    expect(dot).not.toBeNull();
  });

  it('shows red dot when disconnected', () => {
    const { container } = render(<ChatHeader title="Chat" icon={<Zap size={16} />} connected={false} onClose={vi.fn()} />);
    const dot = container.querySelector('.bg-red-500');
    expect(dot).not.toBeNull();
  });

  it('shows yellow pulsing dot when reconnecting', () => {
    const { container } = render(<ChatHeader title="Chat" icon={<Zap size={16} />} connected={false} reconnecting={true} onClose={vi.fn()} />);
    const dot = container.querySelector('.bg-yellow-500');
    expect(dot).not.toBeNull();
    expect(dot?.classList.contains('animate-pulse')).toBe(true);
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<ChatHeader title="Chat" icon={<Zap size={16} />} connected={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides close button when onClose is not provided', () => {
    render(<ChatHeader title="Chat" icon={<Zap size={16} />} connected={true} />);
    expect(screen.queryByLabelText('Close')).toBeNull();
  });
});
