import { ChevronDown, ChevronUp } from 'lucide-react';
import type { MessageRecord } from '@lib/contracts';
import { formatContacts, formatMessageDate, getPrimaryAuthor } from '@components/message-list/messageListUtils';

type MessageHeaderProps = {
  isExpanded: boolean;
  message: MessageRecord;
  onToggle: () => void;
};

export const MessageHeader = ({ isExpanded, message, onToggle }: MessageHeaderProps) => {
  const from = message.from[0]?.email ?? 'unknown@openmail.dev';
  const to = formatContacts(message.to);
  const cc = formatContacts(message.cc);

  return (
    <header className="message-item-header">
      <div>
        <p className="message-author">{getPrimaryAuthor(message)}</p>
        <p className="message-address">{from}</p>
        {isExpanded && to ? <p className="message-address">To: {to}</p> : null}
        {isExpanded && cc ? <p className="message-address">Cc: {cc}</p> : null}
      </div>
      <div className="message-actions">
        <span>{formatMessageDate(message.date)}</span>
        <button
          aria-label={isExpanded ? 'Collapse message' : 'Expand message'}
          className="message-action"
          onClick={onToggle}
          type="button"
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
    </header>
  );
};
