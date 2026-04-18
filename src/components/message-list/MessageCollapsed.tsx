import type { MessageRecord } from '@lib/contracts';
import { formatMessageDate, getPrimaryAuthor } from '@components/message-list/messageListUtils';

type MessageCollapsedProps = {
  message: MessageRecord;
  onExpand: () => void;
};

export const MessageCollapsed = ({ message, onExpand }: MessageCollapsedProps) => (
  <article className="message-card message-card-collapsed">
    <button aria-label="Expand message" onClick={onExpand} type="button">
      <span>
        <strong>{getPrimaryAuthor(message)}</strong>
        <span>{message.snippet || message.plain_text}</span>
      </span>
      <time>{formatMessageDate(message.date)}</time>
    </button>
  </article>
);
