import type { Editor } from '@tiptap/react';

type ComposerToolbarProps = {
  editor: Editor | null;
};

export const ComposerToolbar = ({ editor }: ComposerToolbarProps) => {
  if (!editor) {
    return null;
  }

  const addLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const nextUrl = window.prompt('Enter link URL', previousUrl ?? 'https://');

    if (nextUrl === null) {
      return;
    }

    if (!nextUrl.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().setLink({ href: nextUrl.trim() }).run();
  };

  return (
    <div className="composer-toolbar" aria-label="Composer toolbar">
      <button
        aria-pressed={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        type="button"
      >
        Bold
      </button>
      <button
        aria-pressed={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        type="button"
      >
        Italic
      </button>
      <button
        aria-pressed={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        type="button"
      >
        Bullets
      </button>
      <button
        aria-pressed={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        type="button"
      >
        Numbers
      </button>
      <button
        aria-pressed={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        type="button"
      >
        Quote
      </button>
      <button aria-pressed={editor.isActive('link')} onClick={addLink} type="button">
        Link
      </button>
    </div>
  );
};
