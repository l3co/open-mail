import type { ContactRecord, MessageRecord } from '@lib/contracts';

export const formatMessageDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Agora';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const getPrimaryAuthor = (message: MessageRecord) =>
  message.from[0]?.name ?? message.from[0]?.email ?? 'Open Mail';

export const formatContacts = (contacts: ContactRecord[]) =>
  contacts.map((contact) => contact.name ? `${contact.name} <${contact.email}>` : contact.email).join(', ');

export const sortMessagesChronologically = (messages: MessageRecord[]) =>
  [...messages].sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime());

export const formatAttachmentSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};
