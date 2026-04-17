use std::{collections::HashMap, sync::RwLock};

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

impl CredentialStore for InMemoryCredentialStore {
    fn save(&self, account_id: &str, credentials: Credentials) -> Result<(), SyncError> {
        self.credentials_by_account
            .write()
            .map_err(|_| SyncError::Operation("credential store lock poisoned".into()))?
            .insert(account_id.into(), credentials);
        Ok(())
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
        Ok(())
    }
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
}
