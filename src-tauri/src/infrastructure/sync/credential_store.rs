use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::RwLock,
};

use crate::infrastructure::sync::{Credentials, SyncError};

pub trait CredentialStore: Send + Sync {
    fn save(&self, account_id: &str, credentials: Credentials) -> Result<(), SyncError>;
    fn get(&self, account_id: &str) -> Result<Option<Credentials>, SyncError>;
    fn delete(&self, account_id: &str) -> Result<(), SyncError>;
}

#[derive(Debug, Default)]
pub struct InMemoryCredentialStore {
    credentials_by_account: RwLock<HashMap<String, Credentials>>,
}

#[derive(Debug)]
pub struct FileCredentialStore {
    credentials_by_account: RwLock<HashMap<String, Credentials>>,
    path: PathBuf,
}

impl InMemoryCredentialStore {
    fn read_credentials(&self) -> Result<HashMap<String, Credentials>, SyncError> {
        self.credentials_by_account
            .read()
            .map(|guard| guard.clone())
            .map_err(|_| SyncError::Operation("credential store lock poisoned".into()))
    }
}

impl CredentialStore for InMemoryCredentialStore {
    fn save(&self, account_id: &str, credentials: Credentials) -> Result<(), SyncError> {
        self.credentials_by_account
            .write()
            .map_err(|_| SyncError::Operation("credential store lock poisoned".into()))?
            .insert(account_id.into(), credentials);
        Ok(())
    }

    fn get(&self, account_id: &str) -> Result<Option<Credentials>, SyncError> {
        Ok(self.read_credentials()?.get(account_id).cloned())
    }

    fn delete(&self, account_id: &str) -> Result<(), SyncError> {
        self.credentials_by_account
            .write()
            .map_err(|_| SyncError::Operation("credential store lock poisoned".into()))?
            .remove(account_id);
        Ok(())
    }
}

impl FileCredentialStore {
    pub fn new(path: impl Into<PathBuf>) -> Result<Self, SyncError> {
        let path = path.into();
        let credentials_by_account = load_credentials(&path)?;

        Ok(Self {
            credentials_by_account: RwLock::new(credentials_by_account),
            path,
        })
    }

    fn persist(&self) -> Result<(), SyncError> {
        let serialized = serde_json::to_string_pretty(
            &self
                .credentials_by_account
                .read()
                .map_err(|_| SyncError::Operation("credential store lock poisoned".into()))?
                .clone(),
        )
        .map_err(|error| SyncError::Operation(error.to_string()))?;

        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|error| SyncError::Operation(error.to_string()))?;
        }

        fs::write(&self.path, serialized).map_err(|error| SyncError::Operation(error.to_string()))
    }
}

impl CredentialStore for FileCredentialStore {
    fn save(&self, account_id: &str, credentials: Credentials) -> Result<(), SyncError> {
        self.credentials_by_account
            .write()
            .map_err(|_| SyncError::Operation("credential store lock poisoned".into()))?
            .insert(account_id.into(), credentials);
        self.persist()
    }

    fn get(&self, account_id: &str) -> Result<Option<Credentials>, SyncError> {
        Ok(self
            .credentials_by_account
            .read()
            .map_err(|_| SyncError::Operation("credential store lock poisoned".into()))?
            .get(account_id)
            .cloned())
    }

    fn delete(&self, account_id: &str) -> Result<(), SyncError> {
        self.credentials_by_account
            .write()
            .map_err(|_| SyncError::Operation("credential store lock poisoned".into()))?
            .remove(account_id);
        self.persist()
    }
}

fn load_credentials(path: &Path) -> Result<HashMap<String, Credentials>, SyncError> {
    if !path.is_file() {
        return Ok(HashMap::new());
    }

    let contents = fs::read_to_string(path).map_err(|error| SyncError::Operation(error.to_string()))?;
    serde_json::from_str::<HashMap<String, Credentials>>(&contents)
        .map_err(|error| SyncError::Operation(error.to_string()))
}

pub fn fallback_credentials_for_email(email_address: &str) -> Credentials {
    Credentials::Password {
        username: email_address.into(),
        // Local-only fallback for seeded/demo accounts. Real accounts should save
        // credentials through CredentialStore before SMTP/IMAP work starts.
        password: "local-development-token".into(),
    }
}

#[cfg(test)]
mod tests {
    use std::{
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;

    #[test]
    fn stores_and_deletes_credentials_by_account() {
        let store = InMemoryCredentialStore::default();
        let credentials = Credentials::Password {
            username: "leco@example.com".into(),
            password: "secret".into(),
        };

        store.save("acc_1", credentials.clone()).unwrap();
        assert_eq!(store.get("acc_1").unwrap(), Some(credentials));

        store.delete("acc_1").unwrap();
        assert_eq!(store.get("acc_1").unwrap(), None);
    }

    #[test]
    fn persists_credentials_to_disk() {
        static NEXT_ID: AtomicU64 = AtomicU64::new(1);
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let counter = NEXT_ID.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "open-mail-credentials-{unique_suffix}-{counter}.json"
        ));

        let store = FileCredentialStore::new(&path).unwrap();
        let credentials = Credentials::OAuth2 {
            username: "oauth@example.com".into(),
            access_token: "preview-token".into(),
        };

        store.save("acc_disk", credentials.clone()).unwrap();

        let reloaded_store = FileCredentialStore::new(&path).unwrap();
        assert_eq!(reloaded_store.get("acc_disk").unwrap(), Some(credentials));

        let _ = fs::remove_file(path);
    }
}
