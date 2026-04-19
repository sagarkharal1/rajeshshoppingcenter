import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getImageUrl(path?: string | null) {
  if (!path) return null;
  if (/^(data:|blob:|https?:\/\/)/i.test(path)) return path;
  // Ensure we don't double up on slashes if path comes with a leading slash
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `/api/storage/objects/${cleanPath}`;
}

export function formatNPR(amount: number) {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
