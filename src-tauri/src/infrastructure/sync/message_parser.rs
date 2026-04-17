use std::collections::HashMap;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{
    domain::models::{attachment::Attachment, contact::Contact, message::Message},
    infrastructure::sync::SyncError,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedMessage {
    pub message: Message,
    pub attachments: Vec<AttachmentData>,
    pub raw_size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttachmentData {
    pub metadata: Attachment,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageHeaders {
    pub message_id: Option<String>,
    pub subject: Option<String>,
    pub from: Vec<Contact>,
    pub to: Vec<Contact>,
    pub cc: Vec<Contact>,
    pub in_reply_to: Option<String>,
    pub references: Vec<String>,
    pub date: Option<DateTime<Utc>>,
    pub headers: HashMap<String, String>,
}

#[derive(Debug, Clone)]
struct MessagePart {
    headers: HashMap<String, String>,
    body: String,
}

pub struct MessageParser;

impl MessageParser {
    pub fn parse(
        raw: &[u8],
        account_id: &str,
        folder_id: &str,
    ) -> Result<ParsedMessage, SyncError> {
        let raw_text = String::from_utf8_lossy(raw);
        let (header_text, body) = split_header_body(&raw_text);
        let headers = parse_header_map(header_text);
        let parsed_headers = headers_to_message_headers(&headers, account_id);
        let content_type = header_value(&headers, "content-type").unwrap_or("text/plain");
        let message_id_header = parsed_headers
            .message_id
            .clone()
            .unwrap_or_else(|| format!("<{}@openmail.local>", Uuid::new_v4()));
        let parsed_body = parse_body_parts(content_type, body);
        let html_body = parsed_body
            .html
            .as_deref()
            .map(Self::sanitize_html)
            .unwrap_or_else(|| text_to_html(parsed_body.plain.as_deref().unwrap_or("")));
        let plain_text = parsed_body
            .plain
            .or_else(|| Some(strip_html(&html_body)))
            .filter(|value| !value.trim().is_empty());
        let snippet = Self::generate_snippet(plain_text.as_deref().unwrap_or(&html_body), 140);
        let now = Utc::now();
        let message_id = format!("msg_{}", stable_token(&message_id_header));
        let attachments = parsed_body
            .attachments
            .into_iter()
            .map(|attachment| AttachmentData {
                metadata: Attachment {
                    id: format!("att_{}", Uuid::new_v4()),
                    message_id: message_id.clone(),
                    filename: attachment.filename,
                    content_type: attachment.content_type,
                    size: attachment.data.len() as u64,
                    content_id: attachment.content_id,
                    is_inline: attachment.is_inline,
                    local_path: None,
                },
                data: attachment.data,
            })
            .collect::<Vec<_>>();

        Ok(ParsedMessage {
            message: Message {
                id: message_id,
                account_id: account_id.into(),
                thread_id: format!("thr_{}", stable_token(&message_id_header)),
                from: parsed_headers.from,
                to: parsed_headers.to,
                cc: parsed_headers.cc,
                bcc: vec![],
                reply_to: vec![],
                subject: parsed_headers
                    .subject
                    .unwrap_or_else(|| "(no subject)".into()),
                snippet,
                body: html_body,
                plain_text,
                message_id_header,
                in_reply_to: parsed_headers.in_reply_to,
                references: parsed_headers.references,
                folder_id: folder_id.into(),
                label_ids: vec![],
                is_unread: true,
                is_starred: false,
                is_draft: false,
                date: parsed_headers.date.unwrap_or(now),
                attachments: attachments
                    .iter()
                    .map(|attachment| attachment.metadata.clone())
                    .collect(),
                headers: parsed_headers.headers,
                created_at: now,
                updated_at: now,
            },
            attachments,
            raw_size: raw.len() as u64,
        })
    }

    pub fn parse_headers(raw: &[u8], account_id: &str) -> Result<MessageHeaders, SyncError> {
        let raw_text = String::from_utf8_lossy(raw);
        let (header_text, _) = split_header_body(&raw_text);
        Ok(headers_to_message_headers(
            &parse_header_map(header_text),
            account_id,
        ))
    }

    pub fn sanitize_html(html: &str) -> String {
        let without_scripts = remove_tag_blocks(html, "script");
        let without_styles = remove_tag_blocks(&without_scripts, "style");
        remove_tracking_pixels(&without_styles)
    }

    pub fn generate_snippet(body: &str, max_len: usize) -> String {
        let text = strip_html(body)
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");

        if text.chars().count() <= max_len {
            return text;
        }

        format!(
            "{}...",
            text.chars()
                .take(max_len.saturating_sub(3))
                .collect::<String>()
        )
    }
}

#[derive(Debug, Default)]
struct ParsedBody {
    plain: Option<String>,
    html: Option<String>,
    attachments: Vec<ParsedAttachment>,
}

#[derive(Debug)]
struct ParsedAttachment {
    filename: String,
    content_type: String,
    content_id: Option<String>,
    is_inline: bool,
    data: Vec<u8>,
}

fn parse_body_parts(content_type: &str, body: &str) -> ParsedBody {
    let Some(boundary) = content_type_parameter(content_type, "boundary") else {
        return if content_type.to_ascii_lowercase().contains("text/html") {
            ParsedBody {
                html: Some(body.trim().into()),
                ..Default::default()
            }
        } else {
            ParsedBody {
                plain: Some(body.trim().into()),
                ..Default::default()
            }
        };
    };

    let mut parsed = ParsedBody::default();
    for part in split_multipart_parts(body, &boundary) {
        apply_part(&mut parsed, part);
    }

    parsed
}

fn apply_part(parsed: &mut ParsedBody, part: MessagePart) {
    let content_type = header_value(&part.headers, "content-type").unwrap_or("text/plain");
    let content_disposition = header_value(&part.headers, "content-disposition").unwrap_or("");
    let lower_type = content_type.to_ascii_lowercase();
    let lower_disposition = content_disposition.to_ascii_lowercase();

    if lower_type.starts_with("multipart/") {
        let nested = parse_body_parts(content_type, &part.body);
        parsed.plain = parsed.plain.take().or(nested.plain);
        parsed.html = parsed.html.take().or(nested.html);
        parsed.attachments.extend(nested.attachments);
        return;
    }

    let filename = content_type_parameter(content_disposition, "filename")
        .or_else(|| content_type_parameter(content_type, "name"));
    let is_attachment = lower_disposition.contains("attachment") || filename.is_some();

    if is_attachment {
        parsed.attachments.push(ParsedAttachment {
            filename: filename.unwrap_or_else(|| "attachment.bin".into()),
            content_type: content_type
                .split(';')
                .next()
                .unwrap_or("application/octet-stream")
                .trim()
                .into(),
            content_id: header_value(&part.headers, "content-id").map(trim_angle_brackets),
            is_inline: lower_disposition.contains("inline"),
            data: part.body.trim().as_bytes().to_vec(),
        });
    } else if lower_type.contains("text/html") {
        parsed.html = Some(part.body.trim().into());
    } else if lower_type.contains("text/plain") {
        parsed.plain = Some(part.body.trim().into());
    }
}

fn split_header_body(raw: &str) -> (&str, &str) {
    raw.split_once("\r\n\r\n")
        .or_else(|| raw.split_once("\n\n"))
        .unwrap_or((raw, ""))
}

fn parse_header_map(header_text: &str) -> HashMap<String, String> {
    let mut headers = HashMap::new();
    let mut current_key: Option<String> = None;

    for line in header_text.lines() {
        if line.starts_with(' ') || line.starts_with('\t') {
            if let Some(key) = &current_key {
                let value = headers.entry(key.clone()).or_insert_with(String::new);
                value.push(' ');
                value.push_str(line.trim());
            }
            continue;
        }

        if let Some((key, value)) = line.split_once(':') {
            let normalized_key = key.trim().to_ascii_lowercase();
            headers.insert(normalized_key.clone(), value.trim().into());
            current_key = Some(normalized_key);
        }
    }

    headers
}

fn headers_to_message_headers(
    headers: &HashMap<String, String>,
    account_id: &str,
) -> MessageHeaders {
    MessageHeaders {
        message_id: header_value(headers, "message-id").map(str::to_string),
        subject: header_value(headers, "subject").map(str::to_string),
        from: parse_address_list(header_value(headers, "from").unwrap_or(""), account_id),
        to: parse_address_list(header_value(headers, "to").unwrap_or(""), account_id),
        cc: parse_address_list(header_value(headers, "cc").unwrap_or(""), account_id),
        in_reply_to: header_value(headers, "in-reply-to").map(str::to_string),
        references: header_value(headers, "references")
            .map(|value| value.split_whitespace().map(str::to_string).collect())
            .unwrap_or_default(),
        date: header_value(headers, "date")
            .and_then(|value| DateTime::parse_from_rfc2822(value).ok())
            .map(|value| value.with_timezone(&Utc)),
        headers: headers.clone(),
    }
}

fn header_value<'a>(headers: &'a HashMap<String, String>, key: &str) -> Option<&'a str> {
    headers.get(&key.to_ascii_lowercase()).map(String::as_str)
}

fn parse_address_list(value: &str, account_id: &str) -> Vec<Contact> {
    value
        .split(',')
        .filter_map(|raw| parse_address(raw.trim(), account_id))
        .collect()
}

fn parse_address(value: &str, account_id: &str) -> Option<Contact> {
    if value.is_empty() {
        return None;
    }

    let (name, email) = if let Some((name, rest)) = value.split_once('<') {
        let email = rest.split('>').next().unwrap_or(rest).trim();
        (clean_quoted(name.trim()), email.to_string())
    } else {
        (None, value.trim().to_string())
    };

    if !email.contains('@') {
        return None;
    }

    let now = Utc::now();
    Some(Contact {
        id: format!("ct_{}", stable_token(&email)),
        account_id: account_id.into(),
        name,
        email,
        is_me: false,
        created_at: now,
        updated_at: now,
    })
}

fn split_multipart_parts(body: &str, boundary: &str) -> Vec<MessagePart> {
    let marker = format!("--{boundary}");
    body.split(&marker)
        .filter_map(|section| {
            let trimmed = section.trim_matches(['\r', '\n']);
            if trimmed.is_empty() || trimmed == "--" {
                return None;
            }

            let trimmed = trimmed.strip_suffix("--").unwrap_or(trimmed).trim();
            let (header_text, part_body) = split_header_body(trimmed);
            Some(MessagePart {
                headers: parse_header_map(header_text),
                body: part_body.into(),
            })
        })
        .collect()
}

fn content_type_parameter(value: &str, parameter: &str) -> Option<String> {
    value.split(';').skip(1).find_map(|segment| {
        let (key, value) = segment.trim().split_once('=')?;
        if key.trim().eq_ignore_ascii_case(parameter) {
            Some(clean_quoted(value.trim()).unwrap_or_else(|| value.trim().into()))
        } else {
            None
        }
    })
}

fn clean_quoted(value: &str) -> Option<String> {
    let cleaned = value.trim().trim_matches('"').trim();
    (!cleaned.is_empty()).then(|| cleaned.into())
}

fn trim_angle_brackets(value: &str) -> String {
    value.trim().trim_matches('<').trim_matches('>').into()
}

fn text_to_html(value: &str) -> String {
    let escaped = value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;");
    format!("<p>{}</p>", escaped.replace('\n', "<br />"))
}

fn strip_html(value: &str) -> String {
    let mut output = String::new();
    let mut inside_tag = false;

    for character in value.chars() {
        match character {
            '<' => inside_tag = true,
            '>' => inside_tag = false,
            _ if !inside_tag => output.push(character),
            _ => {}
        }
    }

    output
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn remove_tag_blocks(value: &str, tag: &str) -> String {
    let mut remaining = value.to_string();
    let opening = format!("<{tag}");
    let closing = format!("</{tag}>");

    while let Some(start) = remaining.to_ascii_lowercase().find(&opening) {
        let Some(relative_end) = remaining[start..].to_ascii_lowercase().find(&closing) else {
            remaining.truncate(start);
            break;
        };
        let end = start + relative_end + closing.len();
        remaining.replace_range(start..end, "");
    }

    remaining
}

fn remove_tracking_pixels(value: &str) -> String {
    let mut remaining = value.to_string();

    while let Some(start) = remaining.to_ascii_lowercase().find("<img") {
        let Some(relative_end) = remaining[start..].find('>') else {
            break;
        };
        let end = start + relative_end + 1;
        let tag = &remaining[start..end];
        let lower_tag = tag.to_ascii_lowercase();

        if lower_tag.contains("width=\"1\"") && lower_tag.contains("height=\"1\"") {
            remaining.replace_range(start..end, "");
        } else {
            break;
        }
    }

    remaining
}

fn stable_token(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect::<String>()
        .to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_simple_plain_text_message() {
        let raw = b"Message-ID: <msg-1@example.com>\r\nSubject: Hello\r\nFrom: Leco <leco@example.com>\r\nTo: Team <team@example.com>\r\nDate: Fri, 13 Mar 2026 10:00:00 +0000\r\n\r\nHello from Open Mail.";

        let parsed = MessageParser::parse(raw, "acc_1", "fld_inbox").unwrap();

        assert_eq!(parsed.message.subject, "Hello");
        assert_eq!(parsed.message.from[0].email, "leco@example.com");
        assert_eq!(parsed.message.to[0].name.as_deref(), Some("Team"));
        assert_eq!(
            parsed.message.plain_text.as_deref(),
            Some("Hello from Open Mail.")
        );
        assert!(parsed.message.body.contains("Hello from Open Mail."));
    }

    #[test]
    fn sanitizes_html_and_generates_snippet() {
        let raw = b"Message-ID: <msg-2@example.com>\nSubject: HTML\nFrom: sender@example.com\nContent-Type: text/html\n\n<div>Hello <strong>team</strong><script>alert(1)</script><img width=\"1\" height=\"1\" src=\"https://track.example/p.gif\"></div>";

        let parsed = MessageParser::parse(raw, "acc_1", "fld_inbox").unwrap();

        assert!(!parsed.message.body.contains("<script>"));
        assert!(!parsed.message.body.contains("track.example"));
        assert_eq!(parsed.message.snippet, "Hello team");
    }

    #[test]
    fn parses_multipart_with_attachment() {
        let raw = b"Message-ID: <msg-3@example.com>\r\nSubject: Multipart\r\nFrom: sender@example.com\r\nContent-Type: multipart/mixed; boundary=\"frontier\"\r\n\r\n--frontier\r\nContent-Type: text/plain\r\n\r\nPlain body\r\n--frontier\r\nContent-Type: text/html\r\n\r\n<p>HTML body</p>\r\n--frontier\r\nContent-Type: text/plain; name=\"notes.txt\"\r\nContent-Disposition: attachment; filename=\"notes.txt\"\r\n\r\nAttachment text\r\n--frontier--";

        let parsed = MessageParser::parse(raw, "acc_1", "fld_inbox").unwrap();

        assert_eq!(parsed.message.plain_text.as_deref(), Some("Plain body"));
        assert_eq!(parsed.message.attachments.len(), 1);
        assert_eq!(parsed.message.attachments[0].filename, "notes.txt");
        assert_eq!(parsed.attachments[0].data, b"Attachment text");
    }

    #[test]
    fn parses_headers_without_body() {
        let raw = b"Message-ID: <msg-4@example.com>\r\nSubject: Header only\r\nReferences: <a@example.com> <b@example.com>\r\n\r\nBody";

        let headers = MessageParser::parse_headers(raw, "acc_1").unwrap();

        assert_eq!(headers.message_id.as_deref(), Some("<msg-4@example.com>"));
        assert_eq!(headers.references.len(), 2);
    }
}
