import type { Signature } from '@stores/useSignatureStore';

type ComposerSignaturePanelProps = {
  activeSignatureId: string | null;
  signatures: Signature[];
  onApplySignature: (signatureId: string | null) => void;
  onCreateSignature: () => void;
  onDeleteSignature: (signatureId: string) => void;
  onSetDefault: (signatureId: string) => void;
  onToggleOpen: () => void;
  onUpdateSignature: (signatureId: string, nextSignature: Partial<Omit<Signature, 'id'>>) => void;
};

export const ComposerSignaturePanel = ({
  activeSignatureId,
  signatures,
  onApplySignature,
  onCreateSignature,
  onDeleteSignature,
  onSetDefault,
  onToggleOpen,
  onUpdateSignature
}: ComposerSignaturePanelProps) => {
  const activeSignature = signatures.find((signature) => signature.id === activeSignatureId) ?? null;

  return (
    <section aria-label="Composer signature" className="composer-signature-panel">
      <div className="composer-signature-header">
        <strong>Signature</strong>
        <div className="composer-signature-actions">
          <button onClick={onCreateSignature} type="button">
            New
          </button>
          <button onClick={onToggleOpen} type="button">
            Close
          </button>
        </div>
      </div>

      <label className="composer-field-row">
        <span>Active</span>
        <select
          aria-label="Active signature"
          onChange={(event) => onApplySignature(event.target.value || null)}
          value={activeSignatureId ?? ''}
        >
          <option value="">No signature</option>
          {signatures.map((signature) => (
            <option key={signature.id} value={signature.id}>
              {signature.title}
            </option>
          ))}
        </select>
      </label>

      {activeSignature ? (
        <div className="composer-signature-editor">
          <label className="composer-field-row">
            <span>Title</span>
            <input
              aria-label="Signature title"
              onChange={(event) => onUpdateSignature(activeSignature.id, { title: event.target.value })}
              value={activeSignature.title}
            />
          </label>

          <label className="composer-field-row">
            <span>Body</span>
            <textarea
              aria-label="Signature body"
              onChange={(event) => onUpdateSignature(activeSignature.id, { body: event.target.value })}
              rows={5}
              value={activeSignature.body}
            />
          </label>

          <div className="composer-signature-footer">
            <button onClick={() => onSetDefault(activeSignature.id)} type="button">
              Set default
            </button>
            <button onClick={() => onDeleteSignature(activeSignature.id)} type="button">
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};
