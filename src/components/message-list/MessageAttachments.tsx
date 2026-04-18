import { Download, Paperclip } from 'lucide-react';
import type { AttachmentRecord } from '@lib/contracts';
import { formatAttachmentSize } from '@components/message-list/messageListUtils';

type MessageAttachmentsProps = {
  attachments: AttachmentRecord[];
};

export const MessageAttachments = ({ attachments }: MessageAttachmentsProps) => {
  if (!attachments.length) {
    return null;
  }

  return (
    <div className="message-attachments" aria-label="Message attachments">
      {attachments.map((attachment) => (
        <div className="message-attachment-card" key={attachment.id}>
          <Paperclip size={15} />
          <span>
            <strong>{attachment.filename}</strong>
            <small>{attachment.content_type} · {formatAttachmentSize(attachment.size)}</small>
          </span>
          <button aria-label={`Download ${attachment.filename}`} type="button">
            <Download size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
