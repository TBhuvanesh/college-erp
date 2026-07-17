"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSimulation } from "./SimulationContext";

export interface UserProfile {
  id: string;
  email: string;
  role: "admin" | "faculty" | "student" | "accountant";
  designation?: string;
  departmentId?: string;
  facultyId?: string;
  facultyProfile?: {
    id: string;
    employeeNumber: string;
    fullName: string;
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    designation: string;
  };
  studentId?: string;
  studentProfile?: {
    id: string;
    rollNumber: string;
    fullName: string;
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    semester: number;
  };
}

interface AuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const { setCurrentRole, setCurrentStudentId, setCurrentFacultyId, syncStudent } = useSimulation();

  const syncSimulationState = useCallback((userProfile: UserProfile) => {
    const { role, designation } = userProfile;
    if (role === "admin") {
      setCurrentRole("Admin");
    } else if (role === "faculty") {
      if (designation === "hod") {
        setCurrentRole("HOD" as any);
      } else {
        setCurrentRole("Faculty");
      }
      if (userProfile.facultyProfile?.id) {
        setCurrentFacultyId(userProfile.facultyProfile.id);
      }
    } else if (role === "student") {
      setCurrentRole("Student");
      if (userProfile.studentId) {
        setCurrentStudentId(userProfile.studentId);
      }
      if (userProfile.studentProfile) {
        syncStudent(userProfile.studentProfile, userProfile.email);
      }
    } else if (role === "accountant") {
      setCurrentRole("Accountant");
    }
  }, [setCurrentRole, setCurrentStudentId, setCurrentFacultyId, syncStudent]);

  const checkSession = useCallback(async () => {
    if (typeof window !== "undefined" && localStorage.getItem("erp_has_session") !== "true") {
      setLoading(false);
      return;
    }

    try {
      const res = await window.fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const { accessToken: newAccessToken, user: newUser } = json.data;
          setAccessToken(newAccessToken);
          setUser(newUser);
          syncSimulationState(newUser);
        } else {
          localStorage.removeItem("erp_has_session");
        }
      } else {
        localStorage.removeItem("erp_has_session");
      }
    } catch (err) {
      console.warn("Session restoration failed:", err);
    } finally {
      setLoading(false);
    }
  }, [syncSimulationState]);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkSession();
    }, 0);

    const handleTokenRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { accessToken: newAccessToken, user: newUser } = customEvent.detail;
      setAccessToken(newAccessToken);
      setUser(newUser);
      syncSimulationState(newUser);
    };

    const handleSessionExpired = () => {
      setAccessToken(null);
      setUser(null);
      localStorage.removeItem("erp_has_session");
    };

    window.addEventListener("tokenRefreshed", handleTokenRefreshed);
    window.addEventListener("sessionExpired", handleSessionExpired);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("tokenRefreshed", handleTokenRefreshed);
      window.removeEventListener("sessionExpired", handleSessionExpired);
    };
  }, [checkSession, syncSimulationState]);

  const login = async (email: string, password: string) => {
    const res = await window.fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.message || "Authentication failed");
    }

    const { accessToken: newAccessToken, user: newUser } = json.data;
    setAccessToken(newAccessToken);
    setUser(newUser);
    syncSimulationState(newUser);
    localStorage.setItem("erp_has_session", "true");
  };

  const logout = async () => {
    try {
      await window.fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem("erp_has_session");
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
