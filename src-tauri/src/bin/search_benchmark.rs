use std::{
    env,
    path::PathBuf,
    sync::Arc,
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use chrono::{Duration, Utc};
use open_mail_lib::{
    domain::{
        models::{
            account::{Account, AccountProvider, ConnectionSettings, SecurityType, SyncState},
            contact::Contact,
            folder::{Folder, FolderRole},
            message::Message,
            thread::Thread,
        },
        repositories::{AccountRepository, FolderRepository, MessageRepository, ThreadRepository},
    },
    infrastructure::database::{
        repositories::{
            account_repository::SqliteAccountRepository, folder_repository::SqliteFolderRepository,
            message_repository::SqliteMessageRepository, thread_repository::SqliteThreadRepository,
        },
        Database,
    },
};

const DEFAULT_MESSAGE_COUNT: usize = 100_000;
const DEFAULT_HIT_COUNT: usize = 100;
const BENCHMARK_QUERY: &str = "auroraindexados";

#[tokio::main]
async fn main() -> Result<(), String> {
    let message_count = parse_usize_arg("--messages").unwrap_or(DEFAULT_MESSAGE_COUNT);
    let hit_count = parse_usize_arg("--hits").unwrap_or(DEFAULT_HIT_COUNT);
    let benchmark_path = unique_database_path("open-mail-search-benchmark");

    let db = Database::new(&benchmark_path).map_err(|error| error.to_string())?;
    db.run_migrations().map_err(|error| error.to_string())?;

    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(db.clone()));
    let folder_repo: Arc<dyn FolderRepository> = Arc::new(SqliteFolderRepository::new(db.clone()));
    let thread_repo: Arc<dyn ThreadRepository> = Arc::new(SqliteThreadRepository::new(db.clone()));
    let message_repo: Arc<dyn MessageRepository> =
        Arc::new(SqliteMessageRepository::new(db.clone()));

    seed_benchmark_data(
        account_repo.as_ref(),
        folder_repo.as_ref(),
        thread_repo.as_ref(),
        message_repo.as_ref(),
        message_count,
        hit_count,
    )
    .await?;

    let warmup_started_at = Instant::now();
    let warmup_hits = thread_repo
        .search("acc_bench", BENCHMARK_QUERY)
        .await
        .map_err(|error| error.to_string())?;
    let warmup_elapsed = warmup_started_at.elapsed();

    let measured_started_at = Instant::now();
    let measured_hits = thread_repo
        .search("acc_bench", BENCHMARK_QUERY)
        .await
        .map_err(|error| error.to_string())?;
    let measured_elapsed = measured_started_at.elapsed();

    println!("Open Mail search benchmark");
    println!("database: {}", benchmark_path.display());
    println!("messages: {message_count}");
    println!("expected_hits: {hit_count}");
    println!("warmup_hits: {}", warmup_hits.len());
    println!("warmup_ms: {:.2}", warmup_elapsed.as_secs_f64() * 1000.0);
    println!("measured_hits: {}", measured_hits.len());
    println!(
        "measured_ms: {:.2}",
        measured_elapsed.as_secs_f64() * 1000.0
    );

    Ok(())
}

async fn seed_benchmark_data(
    account_repo: &dyn AccountRepository,
    folder_repo: &dyn FolderRepository,
    thread_repo: &dyn ThreadRepository,
    message_repo: &dyn MessageRepository,
    message_count: usize,
    hit_count: usize,
) -> Result<(), String> {
    let started_at = Instant::now();
    let timestamp = Utc::now();

    account_repo
        .save(&Account {
            id: "acc_bench".into(),
            name: "Benchmark".into(),
            email_address: "bench@example.com".into(),
            provider: AccountProvider::Imap,
            connection_settings: ConnectionSettings {
                imap_host: "imap.example.com".into(),
                imap_port: 993,
                imap_security: SecurityType::Ssl,
                smtp_host: "smtp.example.com".into(),
                smtp_port: 587,
                smtp_security: SecurityType::StartTls,
            },
            sync_state: SyncState::Running,
            created_at: timestamp,
            updated_at: timestamp,
        })
        .await
        .map_err(|error| error.to_string())?;

    folder_repo
        .save(&Folder {
            id: "fld_bench_inbox".into(),
            account_id: "acc_bench".into(),
            name: "Inbox".into(),
            path: "INBOX".into(),
            role: Some(FolderRole::Inbox),
            unread_count: 0,
            total_count: message_count as u32,
            created_at: timestamp,
            updated_at: timestamp,
        })
        .await
        .map_err(|error| error.to_string())?;

    let benchmark_contact = Contact {
        id: "ct_bench_sender".into(),
        account_id: "acc_bench".into(),
        name: Some("Bench Sender".into()),
        email: "sender@example.com".into(),
        is_me: false,
        created_at: timestamp,
        updated_at: timestamp,
    };

    let batch_size = 1_000usize;
    for batch_start in (0..message_count).step_by(batch_size) {
        let mut threads = Vec::with_capacity(batch_size.min(message_count - batch_start));
        let mut messages = Vec::with_capacity(batch_size.min(message_count - batch_start));

        for index in batch_start..(batch_start + batch_size).min(message_count) {
            let is_hit = index < hit_count;
            let item_timestamp = timestamp + Duration::seconds(index as i64);
            let thread_id = format!("thr_bench_{index}");
            let subject = if is_hit {
                format!("Aurora benchmark thread {index}")
            } else {
                format!("Routine benchmark thread {index}")
            };
            let plain_text = if is_hit {
                format!("This message body contains the search token {BENCHMARK_QUERY} for benchmark validation {index}.")
            } else {
                format!("This message body contains routine mailbox traffic sample {index}.")
            };

            threads.push(Thread {
                id: thread_id.clone(),
                account_id: "acc_bench".into(),
                subject: subject.clone(),
                snippet: plain_text.clone(),
                message_count: 1,
                participant_ids: vec![benchmark_contact.email.clone()],
                folder_ids: vec!["fld_bench_inbox".into()],
                label_ids: vec![],
                has_attachments: false,
                is_unread: false,
                is_starred: false,
                last_message_at: item_timestamp,
                last_message_sent_at: Some(item_timestamp),
                created_at: item_timestamp,
                updated_at: item_timestamp,
            });

            messages.push(Message {
                id: format!("msg_bench_{index}"),
                account_id: "acc_bench".into(),
                thread_id,
                from: vec![benchmark_contact.clone()],
                to: vec![],
                cc: vec![],
                bcc: vec![],
                reply_to: vec![],
                subject,
                snippet: plain_text.clone(),
                body: format!("<p>{plain_text}</p>"),
                plain_text: Some(plain_text),
                message_id_header: format!("<msg_bench_{index}@example.com>"),
                in_reply_to: None,
                references: vec![],
                folder_id: "fld_bench_inbox".into(),
                label_ids: vec![],
                is_unread: false,
                is_starred: false,
                is_draft: false,
                date: item_timestamp,
                attachments: vec![],
                headers: Default::default(),
                created_at: item_timestamp,
                updated_at: item_timestamp,
            });
        }

        thread_repo
            .save_batch(&threads)
            .await
            .map_err(|error| error.to_string())?;
        message_repo
            .save_batch(&messages)
            .await
            .map_err(|error| error.to_string())?;
    }

    println!(
        "seeded_messages: {message_count} in {:.2}s",
        started_at.elapsed().as_secs_f64()
    );

    Ok(())
}

fn parse_usize_arg(flag: &str) -> Option<usize> {
    let mut args = env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == flag {
            return args.next().and_then(|value| value.parse::<usize>().ok());
        }
    }
    None
}

fn unique_database_path(prefix: &str) -> PathBuf {
    let unique_suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    env::temp_dir().join(format!("{prefix}-{unique_suffix}.db"))
}
