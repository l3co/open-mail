use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

use rusqlite::Connection;

use crate::domain::errors::DomainError;

const INITIAL_MIGRATION: &str = include_str!("migrations/001_initial_schema.sql");

#[derive(Debug, Clone)]
pub struct Database {
    path: PathBuf,
    connection: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(path: &Path) -> Result<Self, DomainError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| DomainError::Io(error.to_string()))?;
        }

        let connection =
            Connection::open(path).map_err(|error| DomainError::Database(error.to_string()))?;
        connection
            .execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
            .map_err(|error| DomainError::Database(error.to_string()))?;

        Ok(Self {
            path: path.to_path_buf(),
            connection: Arc::new(Mutex::new(connection)),
        })
    }

    pub fn run_migrations(&self) -> Result<(), DomainError> {
        let connection = self.connection()?;
        connection
            .execute_batch(INITIAL_MIGRATION)
            .map_err(|error| DomainError::Database(error.to_string()))?;

        Ok(())
    }

    pub fn connection(&self) -> Result<std::sync::MutexGuard<'_, Connection>, DomainError> {
        self.connection
            .lock()
            .map_err(|_| DomainError::Database("database mutex poisoned".into()))
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

pub fn subsystem_name() -> &'static str {
    "database"
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::Database;

    #[test]
    fn creates_database_and_runs_migrations() {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let database_path = std::env::temp_dir().join(format!("open-mail-{unique_suffix}.db"));
        let database = Database::new(&database_path).unwrap();

        database.run_migrations().unwrap();

        let connection = database.connection().unwrap();
        let mut statement = connection
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'accounts'")
            .unwrap();
        let mut rows = statement.query([]).unwrap();

        assert!(rows.next().unwrap().is_some());
    }
}
