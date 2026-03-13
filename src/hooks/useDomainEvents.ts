import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import type { DomainEvent } from '@lib/contracts';
import { getInvalidationKeysForDomainEvent } from '@lib/query-events';
import { tauriRuntime } from '@lib/tauri-bridge';

export const useDomainEvents = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tauriRuntime.isAvailable()) {
      return undefined;
    }

    let isMounted = true;
    let unlisten: (() => void) | undefined;

    void listen<DomainEvent>('domain:event', (event) => {
      for (const queryKey of getInvalidationKeysForDomainEvent(event.payload)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    }).then((cleanup) => {
      if (isMounted) {
        unlisten = cleanup;
        return;
      }

      cleanup();
    });

    return () => {
      isMounted = false;
      unlisten?.();
    };
  }, [queryClient]);
};
