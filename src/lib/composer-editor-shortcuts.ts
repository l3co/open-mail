import type { Editor } from '@tiptap/react';

type ShortcutEditorInstance = Pick<Editor, 'chain' | 'isActive'>;

export const runComposerListIndentationShortcut = (
  event: KeyboardEvent,
  editorInstance?: ShortcutEditorInstance | null
): boolean => {
  if (!editorInstance || event.key !== 'Tab') {
    return false;
  }

  if (!editorInstance.isActive('bulletList') && !editorInstance.isActive('orderedList')) {
    return false;
  }

  event.preventDefault();

  if (event.shiftKey) {
    return editorInstance.chain().focus().liftListItem('listItem').run();
  }

  return editorInstance.chain().focus().sinkListItem('listItem').run();
};
