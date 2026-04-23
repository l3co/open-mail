const SIGNATURE_START = '<!-- open-mail-signature:start -->';
const SIGNATURE_END = '<!-- open-mail-signature:end -->';

export const wrapSignatureHtml = (signatureBody: string) =>
  `${SIGNATURE_START}<div class="composer-signature-block">${signatureBody}</div>${SIGNATURE_END}`;

export const stripSignatureHtml = (body: string) =>
  body.replace(/<!-- open-mail-signature:start -->[\s\S]*?<!-- open-mail-signature:end -->/g, '').trim();

export const applySignatureHtml = (body: string, signatureBody: string | null) => {
  const content = stripSignatureHtml(body);

  if (!signatureBody?.trim()) {
    return content || '<p></p>';
  }

  const wrappedSignature = wrapSignatureHtml(signatureBody);
  return content ? `${content}${wrappedSignature}` : wrappedSignature;
};

export const hasSignatureHtml = (body: string) => body.includes(SIGNATURE_START) && body.includes(SIGNATURE_END);
