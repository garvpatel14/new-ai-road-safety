export const DEFAULT_POTHOLE_IMAGE = 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80';
export const DEFAULT_CRACK_IMAGE = 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80';
export const DEFAULT_REPAIR_IMAGE = 'https://images.unsplash.com/photo-1584467735815-f778f274e296?auto=format&fit=crop&w=800&q=80';

/**
 * Returns a guaranteed valid image URL for road damage reports.
 * Replaces dead session blobs, local machine URLs, or missing images with high-res road hazard photos.
 */
export const getSafeImageUrl = (imageUrl, type = 'Pothole') => {
  const t = (type || '').toLowerCase();
  const fallback = t.includes('crack')
    ? DEFAULT_CRACK_IMAGE
    : t.includes('repair') || t.includes('resolved')
    ? DEFAULT_REPAIR_IMAGE
    : DEFAULT_POTHOLE_IMAGE;

  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
    return fallback;
  }

  // Session blobs only exist in local browser memory and break on other devices or reload
  if (imageUrl.startsWith('blob:') || imageUrl.includes('localhost:') || imageUrl.includes('127.0.0.1:')) {
    return fallback;
  }

  return imageUrl;
};

/**
 * Image tag onError fallback handler to prevent broken image icon display.
 */
export const handleImageError = (e, type = 'Pothole') => {
  if (e && e.currentTarget) {
    e.currentTarget.onerror = null;
    e.currentTarget.src = getSafeImageUrl(null, type);
  }
};
