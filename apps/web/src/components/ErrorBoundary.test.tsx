const hasDom = typeof globalThis.document !== 'undefined';
const maybeDescribe = hasDom ? describe : describe.skip;

import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowOnFirst({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test explosion');
  return <div>All good</div>;
}

// Suppress React error boundary console noise during tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('Error: Uncaught') || msg.includes('The above error')) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

maybeDescribe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Child content')).toBeDefined();
  });

  it('shows fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowOnFirst shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.getByText('Test explosion')).toBeDefined();
  });

  it('shows retry button that resets the boundary', () => {
    let shouldThrow = true;
    function Toggler() {
      if (shouldThrow) throw new Error('Boom');
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <Toggler />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Boom')).toBeDefined();

    // Fix the component before retrying
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('Recovered')).toBeDefined();
  });
});
