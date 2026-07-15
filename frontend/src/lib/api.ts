const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api";

let globalAccessToken: string | null = null;

export function setGlobalAccessToken(token: string | null) {
  globalAccessToken = token;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string | null
): Promise<T> {
  if (accessToken !== undefined) {
    globalAccessToken = accessToken;
  }

  const headers = new Headers(options.headers);
  const currentToken = accessToken || globalAccessToken;
  
  if (currentToken) {
    headers.set("Authorization", `Bearer ${currentToken}`);
  }
  
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr) {
    console.warn(`Network fetch failed for ${endpoint}:`, netErr);
    return {
      success: false,
      message: "Backend server is currently offline. Please ensure the backend is running."
    } as any;
  }

  let text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error("Invalid JSON response from server");
  }

  // Intercept 401 Unauthorized errors and attempt to refresh the token
  if (response.status === 401 && endpoint !== "/auth/refresh" && endpoint !== "/auth/login") {
    try {
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json();
        if (refreshJson.success && refreshJson.data?.accessToken) {
          const newAccessToken = refreshJson.data.accessToken;
          globalAccessToken = newAccessToken;

          // Dispatch event to sync AuthContext state
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("tokenRefreshed", {
                detail: { accessToken: newAccessToken, user: refreshJson.data.user },
              })
            );
          }

          // Retry the original request
          headers.set("Authorization", `Bearer ${newAccessToken}`);
          try {
            response = await fetch(`${API_URL}${endpoint}`, {
              ...options,
              headers,
            });
            text = await response.text();
            data = text ? JSON.parse(text) : {};
          } catch (retryErr) {
            console.warn("Retry request failed due to network error:", retryErr);
            return {
              success: false,
              message: "Network error during retry. Server is unreachable."
            } as any;
          }
        } else {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("sessionExpired"));
          }
        }
      } else {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sessionExpired"));
        }
      }
    } catch (refreshErr) {
      console.error("Token refresh failed in apiFetch:", refreshErr);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sessionExpired"));
      }
    }
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "An error occurred during the request");
  }

  return data;
}
