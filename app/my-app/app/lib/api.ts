// Single source for the backend base URL. Set NEXT_PUBLIC_API_URL to your
// backend origin (e.g. http://localhost:8000). Unset = frontend talks to
// nothing yet. Adjust the path suffixes below to match your backend routes.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export const apiUrl = (path: string) => `${API_BASE}${path}`;
