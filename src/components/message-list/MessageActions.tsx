import { Forward, MoreHorizontal, Reply, ReplyAll } from 'lucide-react';

export const MessageActions = () => (
  <div className="message-action-bar" aria-label="Message actions">
    <button type="button">
      <Reply size={14} />
      Reply
    </button>
    <button type="button">
      <ReplyAll size={14} />
      Reply all
    </button>
    <button type="button">
      <Forward size={14} />
      Forward
    </button>
    <button aria-label="More message actions" type="button">
      <MoreHorizontal size={14} />
    </button>
  </div>
);
