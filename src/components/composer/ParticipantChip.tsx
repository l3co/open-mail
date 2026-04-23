type ParticipantChipProps = {
  email: string;
  isInvalid: boolean;
  onRemove: () => void;
};

export const ParticipantChip = ({ email, isInvalid, onRemove }: ParticipantChipProps) => (
  <span className={isInvalid ? 'participant-chip participant-chip-invalid' : 'participant-chip'} title={email}>
    <span>{email}</span>
    <button aria-label={`Remove ${email}`} onClick={onRemove} type="button">
      ×
    </button>
  </span>
);
