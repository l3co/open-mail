pub mod credential_store;
pub mod imap_client;
pub mod message_parser;
pub mod outbox_sender;
pub mod smtp_client;
pub mod sync_manager;
pub mod threading;
pub mod types;

pub use credential_store::{
    fallback_credentials_for_email, CredentialStore, InMemoryCredentialStore,
};
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
pub use threading::{ThreadAssignment, ThreadBuilder};
pub use types::{
    Credentials, SyncError, SyncFolderState, SyncMessageObservation, SyncPhase, SyncStatusSnapshot,
};
