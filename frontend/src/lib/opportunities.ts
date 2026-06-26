import { apiFetch } from "./api";
import { Opportunity, PaginatedOpportunities } from "@/types/opportunity";

export async function fetchOpportunities(
  accessToken: string,
  params: {
    type?: string;
    status?: string;
    departmentId?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ success: boolean; data?: PaginatedOpportunities; error?: string }> {
  try {
    const searchParams = new URLSearchParams();
    if (params.type) searchParams.append("type", params.type);
    if (params.status) searchParams.append("status", params.status);
    if (params.departmentId) searchParams.append("departmentId", params.departmentId);
    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("limit", params.limit.toString());

    const queryString = searchParams.toString();
    const endpoint = `/opportunities${queryString ? `?${queryString}` : ""}`;
    const response = await apiFetch(endpoint, { method: "GET" }, accessToken);
    return response;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch opportunities" };
  }
}

export async function fetchBookmarks(
  accessToken: string,
  page = 1,
  limit = 20
): Promise<{ success: boolean; data?: PaginatedOpportunities; error?: string }> {
  try {
    const endpoint = `/opportunities/bookmarks?page=${page}&limit=${limit}`;
    const response = await apiFetch(endpoint, { method: "GET" }, accessToken);
    return response;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch bookmarks" };
  }
}

export async function getOpportunity(
  accessToken: string,
  id: string
): Promise<{ success: boolean; data?: Opportunity; error?: string }> {
  try {
    const response = await apiFetch(`/opportunities/${id}`, { method: "GET" }, accessToken);
    if (response.success && response.data?.opportunity) {
      return { success: true, data: response.data.opportunity };
    }
    return response;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get opportunity details" };
  }
}

export async function createOpportunity(
  accessToken: string,
  data: any
): Promise<{ success: boolean; data?: Opportunity; error?: string }> {
  try {
    const response = await apiFetch(
      "/opportunities",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      accessToken
    );
    if (response.success && response.data?.opportunity) {
      return { success: true, data: response.data.opportunity };
    }
    return response;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create opportunity" };
  }
}

export async function updateOpportunity(
  accessToken: string,
  id: string,
  data: any
): Promise<{ success: boolean; data?: Opportunity; error?: string }> {
  try {
    const response = await apiFetch(
      `/opportunities/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
      accessToken
    );
    if (response.success && response.data?.opportunity) {
      return { success: true, data: response.data.opportunity };
    }
    return response;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update opportunity" };
  }
}

export async function deleteOpportunity(
  accessToken: string,
  id: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await apiFetch(`/opportunities/${id}`, { method: "DELETE" }, accessToken);
    return response;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete opportunity" };
  }
}

export async function toggleBookmark(
  accessToken: string,
  id: string
): Promise<{ success: boolean; data?: { bookmarked: boolean; opportunityId: string }; error?: string }> {
  try {
    const response = await apiFetch(`/opportunities/${id}/bookmark`, { method: "POST" }, accessToken);
    return response;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to toggle bookmark" };
  }
}
