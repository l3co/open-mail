import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComposerEditor } from '@components/composer/ComposerEditor';

describe('ComposerEditor', () => {
  it('renders the TipTap editor surface with the basic formatting toolbar', () => {
    render(<ComposerEditor body="<p>Hello team</p>" onBodyChange={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bullets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Numbers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quote' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link' })).toBeInTheDocument();
  });
});
