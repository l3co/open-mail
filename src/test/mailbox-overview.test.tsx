import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '@/App';

describe('mailbox overview integration', () => {
  it('renders mailbox data in the shell', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <App />
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Premium motion system approved' })).toBeInTheDocument();
    expect(await screen.findByText('Inbox')).toBeInTheDocument();
    expect(await screen.findByText('motion-notes.pdf')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /rust health-check online/i }));

    expect(await screen.findByRole('heading', { name: 'Rust health-check online' })).toBeInTheDocument();
    expect(await screen.findByText('Infra Sync')).toBeInTheDocument();
    expect(screen.queryByText('motion-notes.pdf')).not.toBeInTheDocument();
  });
});
