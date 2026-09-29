
const BACKEND_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=85";

export function resolveImageUrl(img, fallback = DEFAULT_FALLBACK_IMAGE) {
  if (!img) return fallback;
  if (img.startsWith("http://") || img.startsWith("https://") || img.startsWith("data:")) {
    return img;
  }
  if (img.startsWith("/media/")) {
    return `${BACKEND_BASE_URL}${img}`;
  }
  if (img.startsWith("media/")) {
    return `${BACKEND_BASE_URL}/${img}`;
  }
  return img;
}

export default resolveImageUrl;

