import { useMemo, useState } from 'react';

type MessageBodyProps = {
  html: string;
  plainText: string | null;
};

const blockedTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'img']);

const sanitizeEmailHtml = (html: string) => {
  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('*').forEach((element) => {
    if (blockedTags.has(element.tagName.toLowerCase())) {
      element.remove();
      return;
    }

    [...element.attributes].forEach((attribute) => {
      const attributeName = attribute.name.toLowerCase();
      const attributeValue = attribute.value.trim().toLowerCase();
      if (attributeName.startsWith('on') || attributeValue.startsWith('javascript:')) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return template.innerHTML;
};

export const MessageBody = ({ html, plainText }: MessageBodyProps) => {
  const [isQuotedTextVisible, setIsQuotedTextVisible] = useState(false);
  const sanitizedHtml = useMemo(() => sanitizeEmailHtml(html || plainText || ''), [html, plainText]);

  return (
    <div className="message-body">
      <div className="message-body-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
      <button
        aria-expanded={isQuotedTextVisible}
        className="message-quote-toggle"
        onClick={() => setIsQuotedTextVisible((current) => !current)}
        type="button"
      >
        {isQuotedTextVisible ? 'Hide quoted text' : 'Show quoted text'}
      </button>
      {isQuotedTextVisible ? <blockquote className="message-quoted-text">Quoted text placeholder</blockquote> : null}
    </div>
  );
};
