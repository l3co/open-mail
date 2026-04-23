import { Forward, MoreHorizontal, Reply, ReplyAll } from 'lucide-react';

type MessageActionsProps = {
  onForward?: () => void;
  onReply?: () => void;
  onReplyAll?: () => void;
};

export const MessageActions = ({ onForward, onReply, onReplyAll }: MessageActionsProps) => (
  <div className="message-action-bar" aria-label="Message actions">
    <button onClick={onReply} type="button">
      <Reply size={14} />
      Reply
    </button>
    <button onClick={onReplyAll} type="button">
      <ReplyAll size={14} />
      Reply all
    </button>
    <button onClick={onForward} type="button">
      <Forward size={14} />
      Forward
    </button>
    <button aria-label="More message actions" type="button">
      <MoreHorizontal size={14} />
    </button>
  </div>
);
