const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api";

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string | null
): Promise<T> {
  const headers = new Headers(options.headers);
  
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error("Invalid JSON response from server");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "An error occurred during the request");
  }

  return data;
}
