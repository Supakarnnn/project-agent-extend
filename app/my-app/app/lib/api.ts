// Same-origin proxy by default; override only when running backend separately.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/backend-api";

export const apiUrl = (path: string) => `${API_BASE}${path}`;
