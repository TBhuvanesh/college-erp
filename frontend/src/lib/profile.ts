import { apiFetch } from "@/lib/api";

export interface BaseProfile {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  role: "admin" | "faculty" | "student";
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export interface AdminProfile extends BaseProfile {
  role: "admin";
}

export interface FacultyProfile extends BaseProfile {
  role: "faculty";
  employeeNumber: string;
  designation: string;
  department: { id: string; name: string; code: string };
}

export interface StudentProfile extends BaseProfile {
  role: "student";
  id: string;
  rollNumber: string;
  semester: number;
  year: number;
  section: string | null;
  academicYear: string;
  status: string;
  department: { id: string; name: string; code: string };
  program: { id: string; name: string; code: string };
}

export type ProfileView = AdminProfile | FacultyProfile | StudentProfile;

export interface UpdateProfileInput {
  email?: string;
  phoneNumber?: string;
}

export interface ChangePasswordInput {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export interface ProfileApiResponse {
  success: boolean;
  data: {
    profile: ProfileView;
  };
  message?: string;
}

export interface ChangePasswordApiResponse {
  success: boolean;
  message: string;
}

export async function getProfile(accessToken: string): Promise<ProfileView> {
  const res = await apiFetch<ProfileApiResponse>("/profile", {}, accessToken);
  return res.data.profile;
}

export async function updateProfile(
  data: UpdateProfileInput,
  accessToken: string
): Promise<ProfileView> {
  const res = await apiFetch<ProfileApiResponse>(
    "/profile",
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    accessToken
  );
  return res.data.profile;
}

export async function changePassword(
  data: ChangePasswordInput,
  accessToken: string
): Promise<ChangePasswordApiResponse> {
  return apiFetch<ChangePasswordApiResponse>(
    "/profile/change-password",
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    accessToken
  );
}
