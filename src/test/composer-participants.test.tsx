import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ParticipantField } from '@components/composer/ParticipantField';

describe('ParticipantField', () => {
  it('shows autocomplete suggestions and selects with Enter', () => {
    const onChange = vi.fn();

    render(
      <ParticipantField
        label="To"
        onChange={onChange}
        placeholder="Add recipients"
        suggestions={['infra@example.com', 'release@example.com']}
        value={[]}
      />
    );

    const input = screen.getByLabelText('To');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'inf' } });
    expect(screen.getByRole('option', { name: 'infra@example.com' })).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['infra@example.com']);
  });

  it('creates multiple chips from paste and removes the last one with Backspace', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <ParticipantField
        label="Cc"
        onChange={onChange}
        placeholder="Add Cc recipients"
        suggestions={[]}
        value={[]}
      />
    );

    const input = screen.getByLabelText('Cc');
    fireEvent.paste(input, {
      clipboardData: {
        getData: () => 'alice@example.com,\nbob@example.com'
      }
    });
    expect(onChange).toHaveBeenCalledWith(['alice@example.com', 'bob@example.com']);

    rerender(
      <ParticipantField
        label="Cc"
        onChange={onChange}
        placeholder="Add Cc recipients"
        suggestions={[]}
        value={['alice@example.com', 'bob@example.com']}
      />
    );

    fireEvent.keyDown(screen.getByLabelText('Cc'), { key: 'Backspace' });
    expect(onChange).toHaveBeenLastCalledWith(['alice@example.com']);
  });

  it('marks invalid recipient chips visually', () => {
    render(
      <ParticipantField
        label="Bcc"
        onChange={() => undefined}
        placeholder="Add Bcc recipients"
        suggestions={[]}
        value={['invalid-email']}
      />
    );

    expect(screen.getByTitle('invalid-email')).toHaveClass('participant-chip-invalid');
  });
});
