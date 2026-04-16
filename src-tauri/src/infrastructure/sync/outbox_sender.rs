use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::{
    domain::{
        models::outbox::{OutboxMessage, OutboxStatus},
        repositories::{AccountRepository, OutboxRepository},
    },
    infrastructure::sync::{Credentials, SmtpClient, SyncError},
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OutboxSendReport {
    pub account_id: String,
    pub attempted: u32,
    pub sent: u32,
    pub failed: u32,
}

pub async fn drain_outbox_for_account(
    account_repo: &dyn AccountRepository,
    outbox_repo: &dyn OutboxRepository,
    smtp_client: &mut dyn SmtpClient,
    account_id: &str,
) -> Result<OutboxSendReport, SyncError> {
    let account = account_repo
        .find_by_id(account_id)
        .await
        .map_err(|error| SyncError::Operation(error.to_string()))?
        .ok_or_else(|| SyncError::AccountNotFound(account_id.into()))?;
    let queued_messages = outbox_repo
        .find_by_status(account_id, OutboxStatus::Queued)
        .await
        .map_err(|error| SyncError::Operation(error.to_string()))?;
    let credentials = Credentials::Password {
        username: account.email_address.clone(),
        // Placeholder until the credential vault lands. FakeSmtpClient still validates
        // the path without requiring real secrets in local development.
        password: "local-outbox-token".into(),
    };
    let mut report = OutboxSendReport {
        account_id: account_id.into(),
        attempted: 0,
        sent: 0,
        failed: 0,
    };

    for mut message in queued_messages {
        report.attempted += 1;
        mark_sending(outbox_repo, &mut message).await?;

        match smtp_client
            .send(
                &account.connection_settings,
                &credentials,
                &message.mime_message,
            )
            .await
        {
            Ok(_) => {
                mark_sent(outbox_repo, &mut message).await?;
                report.sent += 1;
            }
            Err(error) => {
                mark_failed(outbox_repo, &mut message, error.to_string()).await?;
                report.failed += 1;
            }
        }
    }

    Ok(report)
}

async fn mark_sending(
    outbox_repo: &dyn OutboxRepository,
    message: &mut OutboxMessage,
) -> Result<(), SyncError> {
    message.status = OutboxStatus::Sending;
    message.updated_at = Utc::now();
    save_message(outbox_repo, message).await
}

async fn mark_sent(
    outbox_repo: &dyn OutboxRepository,
    message: &mut OutboxMessage,
) -> Result<(), SyncError> {
    message.status = OutboxStatus::Sent;
    message.last_error = None;
    message.updated_at = Utc::now();
    save_message(outbox_repo, message).await
}

async fn mark_failed(
    outbox_repo: &dyn OutboxRepository,
    message: &mut OutboxMessage,
    error: String,
) -> Result<(), SyncError> {
    message.status = OutboxStatus::Failed;
    message.retry_count += 1;
    message.last_error = Some(error);
    message.updated_at = Utc::now();
    save_message(outbox_repo, message).await
}

async fn save_message(
    outbox_repo: &dyn OutboxRepository,
    message: &OutboxMessage,
) -> Result<(), SyncError> {
    outbox_repo
        .save(message)
        .await
        .map_err(|error| SyncError::Operation(error.to_string()))
}

#[cfg(test)]
mod tests {
    use std::{
        sync::atomic::{AtomicU64, Ordering},
        sync::Arc,
        time::{SystemTime, UNIX_EPOCH},
    };

    use chrono::Utc;

    use super::*;
    use crate::{
        domain::{
            models::{
                account::{Account, AccountProvider, ConnectionSettings, SecurityType, SyncState},
                outbox::OutboxMessage,
            },
            repositories::{AccountRepository, OutboxRepository},
        },
        infrastructure::{
            database::{
                repositories::{
                    account_repository::SqliteAccountRepository,
                    outbox_repository::SqliteOutboxRepository,
                },
                Database,
            },
            sync::{FakeSmtpClient, MailAddress, MimeMessage},
        },
    };

    fn build_repositories() -> (Arc<dyn AccountRepository>, Arc<dyn OutboxRepository>) {
        static NEXT_DB_ID: AtomicU64 = AtomicU64::new(1);
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let counter = NEXT_DB_ID.fetch_add(1, Ordering::Relaxed);
        let database_path = std::env::temp_dir().join(format!(
            "open-mail-outbox-sender-{}-{unique_suffix}-{counter}.db",
            std::process::id()
        ));
        let db = Database::new(&database_path).unwrap();
        db.run_migrations().unwrap();

        (
            Arc::new(SqliteAccountRepository::new(db.clone())),
            Arc::new(SqliteOutboxRepository::new(db)),
        )
    }

    fn account() -> Account {
        let now = Utc::now();
        Account {
            id: "acc_1".into(),
            name: "Personal".into(),
            email_address: "leco@example.com".into(),
            provider: AccountProvider::Imap,
            connection_settings: ConnectionSettings {
                imap_host: "imap.example.com".into(),
                imap_port: 993,
                imap_security: SecurityType::Ssl,
                smtp_host: "smtp.example.com".into(),
                smtp_port: 587,
                smtp_security: SecurityType::StartTls,
            },
            sync_state: SyncState::Sleeping,
            created_at: now,
            updated_at: now,
        }
    }

    fn address(email: &str) -> MailAddress {
        MailAddress {
            name: None,
            email: email.into(),
        }
    }

    fn mime_message() -> MimeMessage {
        MimeMessage {
            from: address("leco@example.com"),
            to: vec![address("team@example.com")],
            cc: vec![],
            bcc: vec![],
            reply_to: None,
            subject: "Outbox".into(),
            html_body: "<p>Ready</p>".into(),
            plain_body: Some("Ready".into()),
            in_reply_to: None,
            references: vec![],
            attachments: vec![],
        }
    }

    fn queued_message(id: &str, mime_message: MimeMessage) -> OutboxMessage {
        let now = Utc::now();
        OutboxMessage {
            id: id.into(),
            account_id: "acc_1".into(),
            mime_message,
            status: OutboxStatus::Queued,
            retry_count: 0,
            last_error: None,
            queued_at: now,
            updated_at: now,
        }
    }

    #[tokio::test]
    async fn drain_outbox_marks_valid_messages_as_sent() {
        let (account_repo, outbox_repo) = build_repositories();
        account_repo.save(&account()).await.unwrap();
        outbox_repo
            .save(&queued_message("out_1", mime_message()))
            .await
            .unwrap();

        let mut smtp_client = FakeSmtpClient::default();
        let report = drain_outbox_for_account(
            account_repo.as_ref(),
            outbox_repo.as_ref(),
            &mut smtp_client,
            "acc_1",
        )
        .await
        .unwrap();
        let sent = outbox_repo.find_by_id("out_1").await.unwrap().unwrap();

        assert_eq!(report.sent, 1);
        assert_eq!(report.failed, 0);
        assert_eq!(sent.status, OutboxStatus::Sent);
        assert_eq!(smtp_client.sent_count(), 1);
    }

    #[tokio::test]
    async fn drain_outbox_marks_invalid_messages_as_failed() {
        let (account_repo, outbox_repo) = build_repositories();
        account_repo.save(&account()).await.unwrap();
        let mut invalid_message = mime_message();
        invalid_message.to.clear();
        outbox_repo
            .save(&queued_message("out_1", invalid_message))
            .await
            .unwrap();

        let mut smtp_client = FakeSmtpClient::default();
        let report = drain_outbox_for_account(
            account_repo.as_ref(),
            outbox_repo.as_ref(),
            &mut smtp_client,
            "acc_1",
        )
        .await
        .unwrap();
        let failed = outbox_repo.find_by_id("out_1").await.unwrap().unwrap();

        assert_eq!(report.sent, 0);
        assert_eq!(report.failed, 1);
        assert_eq!(failed.status, OutboxStatus::Failed);
        assert_eq!(failed.retry_count, 1);
        assert!(failed.last_error.unwrap().contains("recipient"));
    }
}
