pub mod imap_client;
pub mod message_parser;
pub mod outbox_sender;
pub mod smtp_client;
pub mod sync_manager;
pub mod types;

pub use imap_client::{
    FakeImapClientFactory, IdleResult, ImapClient, ImapClientFactory, ImapEnvelope, ImapFolder,
    ImapFolderStatus,
};
pub use message_parser::{AttachmentData, MessageHeaders, MessageParser, ParsedMessage};
pub use outbox_sender::{drain_outbox_for_account, OutboxSendReport};
pub use smtp_client::{
    FakeSmtpClient, MailAddress, MimeAttachment, MimeMessage, SmtpClient, SmtpSendReceipt,
};
pub use sync_manager::{NoopSyncEventEmitter, SyncEventEmitter, SyncManager};
pub use types::{
    Credentials, SyncError, SyncFolderState, SyncMessageObservation, SyncPhase, SyncStatusSnapshot,
};
