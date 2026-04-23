import { useEffect, useRef } from 'react';
import type { ComposerDraft } from '@components/composer/Composer';

export const useDraftAutoSave = (
  draftId: string | null,
  draft: ComposerDraft | null,
  enabled: boolean,
  onSave: (draftId: string, draft: ComposerDraft) => void
) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef('');

  useEffect(() => {
    if (!enabled || !draftId || !draft) {
      return;
    }

    const serialized = JSON.stringify({
      ...draft,
      attachments: []
    });

    if (serialized === lastSavedRef.current) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onSave(draftId, draft);
      lastSavedRef.current = serialized;
    }, 2000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [draft, draftId, enabled, onSave]);
};
