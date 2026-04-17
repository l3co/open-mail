import { useEffect } from 'react';

type ShortcutKey = string;

type ShortcutHandler = (event: KeyboardEvent) => void;

export type KeyboardShortcutMap = Partial<Record<ShortcutKey, ShortcutHandler>>;

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
};

const normalizeKey = (event: KeyboardEvent) => {
  const parts: string[] = [];

  if (event.metaKey || event.ctrlKey) {
    parts.push('mod');
  }

  if (event.shiftKey) {
    parts.push('shift');
  }

  if (event.altKey) {
    parts.push('alt');
  }

  const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
  parts.push(key);

  return parts.join('+');
};

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcutMap) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcut = normalizeKey(event);
      const handler = shortcuts[shortcut];

      if (!handler) {
        return;
      }

      if (isEditableTarget(event.target) && !shortcut.startsWith('mod+')) {
        return;
      }

      event.preventDefault();
      handler(event);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
};
