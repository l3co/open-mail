use async_trait::async_trait;
use lettre::{
    message::{
        header::{ContentId, ContentType},
        Attachment, Mailbox, Message, MultiPart, SinglePart,
    },
    transport::smtp::{
        authentication::Credentials as LettreCredentials,
        client::{Tls, TlsParameters},
    },
    AsyncSmtpTransport, AsyncTransport, Tokio1Executor,
};
use serde::{Deserialize, Serialize};

use crate::domain::models::account::ConnectionSettings;

use super::{Credentials, SyncError};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MailAddress {
    pub name: Option<String>,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MimeAttachment {
    pub filename: String,
    pub content_type: String,
    pub data: Vec<u8>,
    pub is_inline: bool,
    pub content_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MimeMessage {
    pub from: MailAddress,
    pub to: Vec<MailAddress>,
    pub cc: Vec<MailAddress>,
    pub bcc: Vec<MailAddress>,
    pub reply_to: Option<MailAddress>,
    pub subject: String,
    pub html_body: String,
    pub plain_body: Option<String>,
    pub in_reply_to: Option<String>,
    pub references: Vec<String>,
    pub attachments: Vec<MimeAttachment>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmtpSendReceipt {
    pub accepted_recipients: usize,
}

#[async_trait]
pub trait SmtpClient: Send + Sync {
    async fn test_connection(
        &mut self,
        settings: &ConnectionSettings,
        credentials: &Credentials,
    ) -> Result<(), SyncError>;

    async fn send(
        &mut self,
        settings: &ConnectionSettings,
        credentials: &Credentials,
        message: &MimeMessage,
    ) -> Result<SmtpSendReceipt, SyncError>;
}

#[derive(Debug, Default)]
pub struct FakeSmtpClient {
    sent_messages: Vec<MimeMessage>,
}

#[derive(Debug, Default)]
pub struct LettreSmtpClient;

impl FakeSmtpClient {
    pub fn sent_count(&self) -> usize {
        self.sent_messages.len()
    }
}

#[async_trait]
impl SmtpClient for FakeSmtpClient {
    async fn test_connection(
        &mut self,
        settings: &ConnectionSettings,
        credentials: &Credentials,
    ) -> Result<(), SyncError> {
        validate_smtp_settings(settings)?;
        validate_credentials(credentials)?;
        Ok(())
    }

    async fn send(
        &mut self,
        settings: &ConnectionSettings,
        credentials: &Credentials,
        message: &MimeMessage,
    ) -> Result<SmtpSendReceipt, SyncError> {
        self.test_connection(settings, credentials).await?;
        validate_message(message)?;

        let accepted_recipients = message.to.len() + message.cc.len() + message.bcc.len();
        self.sent_messages.push(message.clone());

        Ok(SmtpSendReceipt {
            accepted_recipients,
        })
    }
}

#[async_trait]
impl SmtpClient for LettreSmtpClient {
    async fn test_connection(
        &mut self,
        settings: &ConnectionSettings,
        credentials: &Credentials,
    ) -> Result<(), SyncError> {
        validate_smtp_settings(settings)?;
        validate_credentials(credentials)?;
        let transport = build_transport(settings, credentials)?;
        transport.test_connection().await.map_err(map_smtp_error)?;
        Ok(())
    }

    async fn send(
        &mut self,
        settings: &ConnectionSettings,
        credentials: &Credentials,
        message: &MimeMessage,
    ) -> Result<SmtpSendReceipt, SyncError> {
        validate_smtp_settings(settings)?;
        validate_credentials(credentials)?;
        validate_message(message)?;

        let recipients = message.to.len() + message.cc.len() + message.bcc.len();
        let transport = build_transport(settings, credentials)?;
        let built_message = build_message(message)?;
        transport.send(built_message).await.map_err(map_smtp_error)?;

        Ok(SmtpSendReceipt {
            accepted_recipients: recipients,
        })
    }
}

fn validate_smtp_settings(settings: &ConnectionSettings) -> Result<(), SyncError> {
    if settings.smtp_host.trim().is_empty() {
        return Err(SyncError::Connection("smtp host cannot be empty".into()));
    }

    if settings.smtp_port == 0 {
        return Err(SyncError::Connection("smtp port cannot be zero".into()));
    }

    Ok(())
}

fn validate_credentials(credentials: &Credentials) -> Result<(), SyncError> {
    let (username, secret) = match credentials {
        Credentials::Password { username, password } => (username, password),
        Credentials::OAuth2 {
            username,
            access_token,
        } => (username, access_token),
    };

    if username.trim().is_empty() || secret.trim().is_empty() {
        return Err(SyncError::Connection(
            "smtp credentials cannot be empty".into(),
        ));
    }

    Ok(())
}

fn validate_message(message: &MimeMessage) -> Result<(), SyncError> {
    if message.from.email.trim().is_empty() {
        return Err(SyncError::Operation(
            "mime message sender cannot be empty".into(),
        ));
    }

    if message.to.is_empty() && message.cc.is_empty() && message.bcc.is_empty() {
        return Err(SyncError::Operation(
            "mime message must have at least one recipient".into(),
        ));
    }

    if message.subject.trim().is_empty() {
        return Err(SyncError::Operation(
            "mime message subject cannot be empty".into(),
        ));
    }

    if message.html_body.trim().is_empty()
        && message
            .plain_body
            .as_deref()
            .is_none_or(|plain_body| plain_body.trim().is_empty())
    {
        return Err(SyncError::Operation(
            "mime message body cannot be empty".into(),
        ));
    }

    Ok(())
}

fn build_transport(
    settings: &ConnectionSettings,
    credentials: &Credentials,
) -> Result<AsyncSmtpTransport<Tokio1Executor>, SyncError> {
    let transport_builder = match settings.smtp_security {
        crate::domain::models::account::SecurityType::Ssl => AsyncSmtpTransport::<Tokio1Executor>::relay(&settings.smtp_host)
            .map_err(map_smtp_error)?
            .port(settings.smtp_port),
        crate::domain::models::account::SecurityType::StartTls => {
            let tls_parameters = TlsParameters::new(settings.smtp_host.clone()).map_err(map_smtp_error)?;
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&settings.smtp_host)
                .map_err(map_smtp_error)?
                .tls(Tls::Required(tls_parameters))
                .port(settings.smtp_port)
        }
        crate::domain::models::account::SecurityType::None => {
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&settings.smtp_host)
                .port(settings.smtp_port)
        }
    };

    match credentials {
        Credentials::Password { username, password } => Ok(transport_builder
            .credentials(LettreCredentials::new(
                username.clone(),
                password.clone(),
            ))
            .build()),
        Credentials::OAuth2 { .. } => Err(SyncError::Operation(
            "smtp oauth2 sending is not configured yet".into(),
        )),
    }
}

fn build_message(message: &MimeMessage) -> Result<Message, SyncError> {
    let mut builder = Message::builder()
        .from(to_mailbox(&message.from)?)
        .subject(message.subject.clone());

    for address in &message.to {
        builder = builder.to(to_mailbox(address)?);
    }

    for address in &message.cc {
        builder = builder.cc(to_mailbox(address)?);
    }

    for address in &message.bcc {
        builder = builder.bcc(to_mailbox(address)?);
    }

    if let Some(reply_to) = &message.reply_to {
        builder = builder.reply_to(to_mailbox(reply_to)?);
    }

    if let Some(in_reply_to) = &message.in_reply_to {
        builder = builder.in_reply_to(in_reply_to.clone());
    }

    if !message.references.is_empty() {
        builder = builder.references(message.references.join(" "));
    }

    let plain_part = message.plain_body.as_ref().map(|plain_body| {
        SinglePart::builder()
            .header(ContentType::TEXT_PLAIN)
            .body(plain_body.clone())
    });
    let html_part = if !message.html_body.trim().is_empty() {
        Some(
            SinglePart::builder()
                .header(ContentType::TEXT_HTML)
                .body(message.html_body.clone()),
        )
    } else {
        None
    };

    let body_part = match (plain_part, html_part) {
        (Some(plain_part), Some(html_part)) => MultiPart::alternative()
            .singlepart(plain_part)
            .singlepart(html_part),
        (Some(plain_part), None) => MultiPart::mixed().singlepart(plain_part),
        (None, Some(html_part)) => MultiPart::mixed().singlepart(html_part),
        (None, None) => {
            return Err(SyncError::Operation(
                "mime message body cannot be empty".into(),
            ))
        }
    };

    let multipart = message.attachments.iter().try_fold(body_part, |multipart, attachment| {
        let content_type = ContentType::parse(&attachment.content_type)
            .map_err(|error| SyncError::Operation(error.to_string()))?;
        let part = if attachment.is_inline {
            let content_id = attachment
                .content_id
                .clone()
                .unwrap_or_else(|| attachment.filename.clone());
            SinglePart::builder()
                .header(content_type)
                .header(ContentId::from(content_id))
                .body(attachment.data.clone())
        } else {
            Attachment::new(attachment.filename.clone()).body(attachment.data.clone(), content_type)
        };

        Ok::<MultiPart, SyncError>(multipart.singlepart(part))
    })?;

    builder.multipart(multipart).map_err(map_smtp_error)
}

fn to_mailbox(address: &MailAddress) -> Result<Mailbox, SyncError> {
    let parsed = address
        .email
        .parse()
        .map_err(|error| SyncError::Operation(format!("invalid email address {}: {error}", address.email)))?;
    Ok(Mailbox::new(address.name.clone(), parsed))
}

fn map_smtp_error(error: impl std::fmt::Display) -> SyncError {
    SyncError::Connection(error.to_string())
}

#[cfg(test)]
mod tests {
    use crate::domain::models::account::SecurityType;

    use super::*;

    fn settings() -> ConnectionSettings {
        ConnectionSettings {
            imap_host: "imap.example.com".into(),
            imap_port: 993,
            imap_security: SecurityType::Ssl,
            smtp_host: "smtp.example.com".into(),
            smtp_port: 587,
            smtp_security: SecurityType::StartTls,
        }
    }

    fn credentials() -> Credentials {
        Credentials::Password {
            username: "leco@example.com".into(),
            password: "demo-password".into(),
        }
    }

    fn address(email: &str) -> MailAddress {
        MailAddress {
            name: None,
            email: email.into(),
        }
    }

    fn message() -> MimeMessage {
        MimeMessage {
            from: address("leco@example.com"),
            to: vec![address("team@example.com")],
            cc: vec![],
            bcc: vec![],
            reply_to: None,
            subject: "Open Mail sync update".into(),
            html_body: "<p>Sync is ready.</p>".into(),
            plain_body: Some("Sync is ready.".into()),
            in_reply_to: None,
            references: vec![],
            attachments: vec![MimeAttachment {
                filename: "report.txt".into(),
                content_type: "text/plain".into(),
                data: b"ready".to_vec(),
                is_inline: false,
                content_id: None,
            }],
        }
    }

    #[tokio::test]
    async fn fake_smtp_client_sends_valid_mime_messages() {
        let mut client = FakeSmtpClient::default();
        let receipt = client
            .send(&settings(), &credentials(), &message())
            .await
            .unwrap();

        assert_eq!(receipt.accepted_recipients, 1);
        assert_eq!(client.sent_count(), 1);
    }

    #[tokio::test]
    async fn fake_smtp_client_rejects_messages_without_recipients() {
        let mut message = message();
        message.to.clear();

        let error = FakeSmtpClient::default()
            .send(&settings(), &credentials(), &message)
            .await
            .unwrap_err();

        assert!(error.to_string().contains("recipient"));
    }

    #[test]
    fn build_message_preserves_html_and_attachments() {
        let message = build_message(&message()).unwrap();
        let formatted = String::from_utf8(message.formatted()).unwrap();

        assert!(formatted.contains("Subject: Open Mail sync update"));
        assert!(formatted.contains("multipart/"));
        assert!(formatted.contains("report.txt"));
        assert!(formatted.contains("Sync is ready."));
    }
}
