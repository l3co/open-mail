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
    expect(await screen.findByRole('button', { name: /inbox/i })).toBeInTheDocument();
    expect(await screen.findByText('motion-notes.pdf')).toBeInTheDocument();
    expect(await screen.findByText('design-review')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /starred/i }));
    expect(await screen.findByRole('heading', { name: 'Rust health-check online' })).toBeInTheDocument();
    expect(screen.queryByText('motion-notes.pdf')).not.toBeInTheDocument();
    expect(await screen.findByText('tauri-health')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /sent/i }));
    expect(await screen.findByRole('heading', { name: 'Ship notes for desktop alpha' })).toBeInTheDocument();
    expect(await screen.findByText('release@example.com')).toBeInTheDocument();
    expect(await screen.findByText('desktop-alpha')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /archive/i }));
    expect(await screen.findByText('Archive is clear')).toBeInTheDocument();
  });

  it('filters threads through the shell search input', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <App />
      </QueryClientProvider>
    );

    const searchInput = await screen.findByRole('textbox');
    fireEvent.change(searchInput, { target: { value: 'rust' } });

    expect(await screen.findByRole('heading', { name: 'Rust health-check online' })).toBeInTheDocument();
    expect(await screen.findByText('Search results for "rust"')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Premium motion system approved' })).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'no-match-term' } });
    expect(await screen.findByText('No results found')).toBeInTheDocument();
  });
});
