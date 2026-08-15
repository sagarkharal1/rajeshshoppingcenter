import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// In the packaged Android app the page is served from https://localhost, so a
// relative /api path resolves against the WebView instead of the shop's server
// and every image comes back empty. The Android shell sets this global before
// any app code runs. On the website it is undefined and paths stay relative,
// exactly as before.
export function apiOrigin(): string {
  return (globalThis as { __RAJESH_API_ORIGIN__?: string }).__RAJESH_API_ORIGIN__ ?? "";
}

export function getImageUrl(path?: string | null) {
  if (!path) return null;
  if (/^(data:|blob:|https?:\/\/)/i.test(path)) return path;
  // Ensure we don't double up on slashes if path comes with a leading slash
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${apiOrigin()}/api/storage/objects/${cleanPath}`;
}

export function formatNPR(amount: number) {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
