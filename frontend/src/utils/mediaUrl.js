/**
 * Media & Image URL Resolution Utility for Janmitra Civic Portal
 * Seamlessly normalizes local uploaded media paths (/media/complaints/...) to the backend host,
 * supports full HTTPS URLs, and provides safe fallbacks for missing/corrupted attachments.
 */

const FALLBACK_DEFECT_PHOTO =
  'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=600&q=80';

export const resolveMediaUrl = (rawUrl, fallback = FALLBACK_DEFECT_PHOTO) => {
  if (!rawUrl) return fallback;

  // Extract string if wrapped in object (e.g. { image: '...' } or { file: '...' } or { url: '...' })
  const url =
    typeof rawUrl === 'string'
      ? rawUrl
      : rawUrl.url || rawUrl.image || rawUrl.file || '';

  if (!url || typeof url !== 'string' || !url.trim()) return fallback;

  const trimmed = url.trim();

  // If already absolute URL or data URI / blob
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Prepend backend base host for relative media paths
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const apiBase =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
    'http://localhost:8000';
  const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;

  return `${cleanBase}${cleanPath}`;
};

export default resolveMediaUrl;

