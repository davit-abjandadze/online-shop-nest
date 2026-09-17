const SNIPPET_MAX_LENGTH = 140;

// user-facing სიაში (GET /notifications) სრული contentHtml არ გვჭირდება —
// ტეგების მოცილება + სიგრძის შეზღუდვა, რომ dropdown/list item მოკლე
// preview-ს აჩვენებდეს.
export function buildNotificationSnippet(contentHtml: string): string {
  const text = contentHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= SNIPPET_MAX_LENGTH) {
    return text;
  }
  return `${text.slice(0, SNIPPET_MAX_LENGTH).trimEnd()}...`;
}
