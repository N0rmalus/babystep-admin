const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

const HTML_ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const normalizeRichTextContent = (value?: string | null) => {
  if (!value?.trim()) {
    return '';
  }

  if (HTML_TAG_PATTERN.test(value)) {
    return value;
  }

  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
};

export const getPlainTextFromRichText = (value?: string | null) =>
  (value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => HTML_ENTITY_MAP[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();
