use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::domain::models::account::AccountProvider;

use super::{Credentials, SyncError};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OAuthProviderConfig {
    pub provider: AccountProvider,
    pub client_id: String,
    pub auth_url: String,
    pub token_url: String,
    pub revoke_url: Option<String>,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
    pub pkce_required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OAuthAuthorizationRequest {
    pub provider: AccountProvider,
    pub authorization_url: String,
    pub state: String,
    pub scopes: Vec<String>,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub scopes: Vec<String>,
}

pub struct OAuthManager;

impl OAuthManager {
    pub fn provider_config(
        provider: AccountProvider,
        client_id: impl Into<String>,
        redirect_uri: impl Into<String>,
    ) -> Result<OAuthProviderConfig, SyncError> {
        let client_id = client_id.into();
        let redirect_uri = redirect_uri.into();

        if client_id.trim().is_empty() {
            return Err(SyncError::Operation(
                "oauth client id cannot be empty".into(),
            ));
        }

        if redirect_uri.trim().is_empty() {
            return Err(SyncError::Operation(
                "oauth redirect uri cannot be empty".into(),
            ));
        }

        let (auth_url, token_url, revoke_url, scopes, pkce_required) = match provider {
            AccountProvider::Gmail => (
                "https://accounts.google.com/o/oauth2/v2/auth",
                "https://oauth2.googleapis.com/token",
                Some("https://oauth2.googleapis.com/revoke"),
                vec!["https://mail.google.com/"],
                true,
            ),
            AccountProvider::Outlook | AccountProvider::Exchange => (
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                None,
                vec![
                    "https://outlook.office365.com/IMAP.AccessAsUser.All",
                    "https://outlook.office365.com/SMTP.Send",
                    "offline_access",
                ],
                true,
            ),
            AccountProvider::Yahoo | AccountProvider::Imap => {
                return Err(SyncError::Operation(format!(
                    "oauth is not supported for provider {provider}"
                )));
            }
        };

        Ok(OAuthProviderConfig {
            provider,
            client_id,
            auth_url: auth_url.into(),
            token_url: token_url.into(),
            revoke_url: revoke_url.map(String::from),
            redirect_uri,
            scopes: scopes.into_iter().map(String::from).collect(),
            pkce_required,
        })
    }

    pub fn authorization_request(
        config: &OAuthProviderConfig,
        state: impl Into<String>,
        code_challenge: Option<&str>,
    ) -> Result<OAuthAuthorizationRequest, SyncError> {
        let state = state.into();
        if state.trim().is_empty() {
            return Err(SyncError::Operation("oauth state cannot be empty".into()));
        }

        if config.pkce_required && code_challenge.is_none_or(str::is_empty) {
            return Err(SyncError::Operation(
                "oauth pkce code challenge cannot be empty".into(),
            ));
        }

        let scope = config.scopes.join(" ");
        let mut params = vec![
            ("client_id", config.client_id.as_str()),
            ("redirect_uri", config.redirect_uri.as_str()),
            ("response_type", "code"),
            ("scope", scope.as_str()),
            ("state", state.as_str()),
            ("access_type", "offline"),
            ("prompt", "consent"),
        ];

        if let Some(code_challenge) = code_challenge {
            params.push(("code_challenge", code_challenge));
            params.push(("code_challenge_method", "S256"));
        }

        let query = params
            .into_iter()
            .map(|(key, value)| format!("{}={}", percent_encode(key), percent_encode(value)))
            .collect::<Vec<_>>()
            .join("&");

        Ok(OAuthAuthorizationRequest {
            provider: config.provider.clone(),
            authorization_url: format!("{}?{query}", config.auth_url),
            state,
            scopes: config.scopes.clone(),
            redirect_uri: config.redirect_uri.clone(),
        })
    }

    pub fn credentials_from_tokens(
        username: impl Into<String>,
        tokens: &OAuthTokens,
    ) -> Result<Credentials, SyncError> {
        let username = username.into();
        if username.trim().is_empty() || tokens.access_token.trim().is_empty() {
            return Err(SyncError::Operation(
                "oauth credentials require username and access token".into(),
            ));
        }

        Ok(Credentials::OAuth2 {
            username,
            access_token: tokens.access_token.clone(),
        })
    }
}

impl OAuthTokens {
    pub fn expires_within(&self, now: DateTime<Utc>, skew: Duration) -> bool {
        let Ok(skew) = chrono::Duration::from_std(skew) else {
            return true;
        };

        self.expires_at <= now + skew
    }
}

fn percent_encode(input: &str) -> String {
    input.bytes().fold(String::new(), |mut encoded, byte| {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }

        encoded
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_gmail_authorization_url_with_scopes_state_and_pkce() {
        let config = OAuthManager::provider_config(
            AccountProvider::Gmail,
            "gmail-client",
            "openmail://oauth/callback",
        )
        .unwrap();

        let request =
            OAuthManager::authorization_request(&config, "csrf-state", Some("challenge-value"))
                .unwrap();

        assert_eq!(request.provider, AccountProvider::Gmail);
        assert!(request
            .authorization_url
            .starts_with("https://accounts.google.com/o/oauth2/v2/auth?"));
        assert!(request.authorization_url.contains("client_id=gmail-client"));
        assert!(request
            .authorization_url
            .contains("redirect_uri=openmail%3A%2F%2Foauth%2Fcallback"));
        assert!(request
            .authorization_url
            .contains("scope=https%3A%2F%2Fmail.google.com%2F"));
        assert!(request.authorization_url.contains("state=csrf-state"));
        assert!(request
            .authorization_url
            .contains("code_challenge=challenge-value"));
    }

    #[test]
    fn builds_outlook_config_with_imap_smtp_and_refresh_scopes() {
        let config = OAuthManager::provider_config(
            AccountProvider::Outlook,
            "outlook-client",
            "openmail://oauth/callback",
        )
        .unwrap();

        assert_eq!(
            config.auth_url,
            "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
        );
        assert!(config
            .scopes
            .contains(&"https://outlook.office365.com/IMAP.AccessAsUser.All".into()));
        assert!(config
            .scopes
            .contains(&"https://outlook.office365.com/SMTP.Send".into()));
        assert!(config.scopes.contains(&"offline_access".into()));
    }

    #[test]
    fn rejects_unsupported_oauth_provider() {
        let error = OAuthManager::provider_config(
            AccountProvider::Imap,
            "client",
            "openmail://oauth/callback",
        )
        .unwrap_err();

        assert!(error.to_string().contains("not supported"));
    }

    #[test]
    fn converts_tokens_to_oauth_credentials() {
        let tokens = OAuthTokens {
            access_token: "access-token".into(),
            refresh_token: Some("refresh-token".into()),
            expires_at: Utc::now() + chrono::Duration::hours(1),
            scopes: vec!["https://mail.google.com/".into()],
        };

        let credentials =
            OAuthManager::credentials_from_tokens("leco@example.com", &tokens).unwrap();

        assert_eq!(
            credentials,
            Credentials::OAuth2 {
                username: "leco@example.com".into(),
                access_token: "access-token".into()
            }
        );
    }

    #[test]
    fn detects_tokens_inside_refresh_skew() {
        let now = DateTime::parse_from_rfc3339("2026-03-13T10:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let tokens = OAuthTokens {
            access_token: "access-token".into(),
            refresh_token: Some("refresh-token".into()),
            expires_at: now + chrono::Duration::minutes(4),
            scopes: vec![],
        };

        assert!(tokens.expires_within(now, Duration::from_secs(300)));
    }
}
