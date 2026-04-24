import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComposerEditor } from '@components/composer/ComposerEditor';

describe('ComposerEditor', () => {
  it('renders the TipTap editor surface with the expanded formatting toolbar', () => {
    render(<ComposerEditor body="<p>Hello team</p>" onBodyChange={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Underline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Strike' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bullets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Numbers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quote' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link' })).toBeInTheDocument();
  });

  it('surfaces editor shortcuts in the toolbar affordances', () => {
    render(<ComposerEditor body="<p>Hello team</p>" onBodyChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('title', 'Bold (Cmd+B)');
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('title', 'Italic (Cmd+I)');
    expect(screen.getByRole('button', { name: 'Underline' })).toHaveAttribute('title', 'Underline (Cmd+U)');
  });

  it('syncs external body updates into the TipTap editor', async () => {
    const { rerender } = render(<ComposerEditor body="<p>Hello team</p>" onBodyChange={vi.fn()} />);

    rerender(<ComposerEditor body="<p>Updated body</p>" onBodyChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveTextContent('Updated body');
    });
  });
});
