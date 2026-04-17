use std::{
    collections::VecDeque,
    sync::{Mutex, MutexGuard},
};

use crate::{domain::tasks::MailTask, infrastructure::sync::SyncError};

pub trait MailTaskQueue: Send + Sync {
    fn enqueue(&self, task: MailTask) -> Result<(), SyncError>;
    fn pending_count(&self) -> Result<usize, SyncError>;
    fn drain(&self) -> Result<Vec<MailTask>, SyncError>;
}

#[derive(Debug, Default)]
pub struct InMemoryMailTaskQueue {
    tasks: Mutex<VecDeque<MailTask>>,
}

impl MailTaskQueue for InMemoryMailTaskQueue {
    fn enqueue(&self, task: MailTask) -> Result<(), SyncError> {
        self.lock()?.push_back(task);
        Ok(())
    }

    fn pending_count(&self) -> Result<usize, SyncError> {
        Ok(self.lock()?.len())
    }

    fn drain(&self) -> Result<Vec<MailTask>, SyncError> {
        Ok(self.lock()?.drain(..).collect())
    }
}

impl InMemoryMailTaskQueue {
    fn lock(&self) -> Result<MutexGuard<'_, VecDeque<MailTask>>, SyncError> {
        self.tasks
            .lock()
            .map_err(|_| SyncError::Operation("mail task queue lock poisoned".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queues_and_drains_mail_tasks() {
        let queue = InMemoryMailTaskQueue::default();

        queue
            .enqueue(MailTask::MarkAsRead {
                message_ids: vec!["msg_1".into()],
            })
            .unwrap();

        assert_eq!(queue.pending_count().unwrap(), 1);
        assert_eq!(queue.drain().unwrap().len(), 1);
        assert_eq!(queue.pending_count().unwrap(), 0);
    }
}
