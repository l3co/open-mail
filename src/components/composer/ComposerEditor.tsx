import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
import { ComposerToolbar } from '@components/composer/ComposerToolbar';

type ComposerEditorProps = {
  body: string;
  onBodyChange: (value: string) => void;
};

const toInitialHtml = (body: string) => {
  if (!body.trim()) {
    return '<p></p>';
  }

  if (body.trim().startsWith('<')) {
    return body;
  }

  return `<p>${body}</p>`;
};

export const ComposerEditor = ({ body, onBodyChange }: ComposerEditorProps) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2]
        }
      }),
      Placeholder.configure({
        placeholder: 'Write your message...'
      })
    ],
    content: toInitialHtml(body),
    editorProps: {
      attributes: {
        'aria-label': 'Message',
        class: 'composer-rich-editor',
        role: 'textbox'
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      onBodyChange(currentEditor.getHTML());
    }
  });

  return (
    <div className="composer-editor-shell">
      <ComposerToolbar editor={editor} />
      <div className="composer-editor-field">
        <span>Message</span>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
