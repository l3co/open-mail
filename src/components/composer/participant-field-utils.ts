const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const parseRecipients = (value: string) =>
  value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const isValidEmail = (value: string) => emailPattern.test(value);

export { isValidEmail, parseRecipients };
