/**
 * Dashboard Shared Utility Helpers
 */

/**
 * Parses a value that could be a JSON string or an object/array.
 * Safely returns an array even if parsing fails.
 */
export const parseJsonOrArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string') return [v];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    console.warn('Failed to parse JSON:', v);
    return [];
  }
};

/**
 * Normalizes flag items for display, ensuring they have a title and detail.
 * Supports string flags or object flags with various naming conventions.
 */
export const normalizeFlagItems = (flags) => {
  if (!Array.isArray(flags)) return [];
  return flags
    .map((flag) => {
      if (typeof flag === 'string') {
        return { title: flag, detail: '' };
      }
      if (!flag || typeof flag !== 'object') return null;
      const title = String(flag.title || flag.label || flag.name || '').trim();
      const detail = String(flag.detail || flag.description || flag.reason || '').trim();
      if (!title && !detail) return null;
      return {
        title: title || 'Flag',
        detail,
      };
    })
    .filter(Boolean);
};

/**
 * Escapes HTML special characters in a string.
 */
export const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
