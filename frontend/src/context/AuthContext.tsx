"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSimulation } from "./SimulationContext";

export interface UserProfile {
  id: string;
  email: string;
  role: "admin" | "faculty" | "student" | "accountant";
  designation?: string;
  departmentId?: string;
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

  const { setCurrentRole, setCurrentStudentId, setCurrentFacultyId } = useSimulation();

  const syncSimulationState = useCallback((role: "admin" | "faculty" | "student" | "accountant", designation?: string) => {
    if (role === "admin") {
      setCurrentRole("Admin");
    } else if (role === "faculty") {
      if (designation === "hod") {
        setCurrentRole("HOD" as any);
      } else {
        setCurrentRole("Faculty");
      }
      setCurrentFacultyId("fac-amit");
    } else if (role === "student") {
      setCurrentRole("Student");
      setCurrentStudentId("stud-rahul");
    } else if (role === "accountant") {
      setCurrentRole("Accountant");
    }
  }, [setCurrentRole, setCurrentStudentId, setCurrentFacultyId]);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
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
          syncSimulationState(newUser.role, newUser.designation);
        }
      }
    } catch (err) {
      console.error("Session restoration failed:", err);
    } finally {
      setLoading(false);
    }
  }, [syncSimulationState]);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkSession();
    }, 0);
    return () => clearTimeout(timer);
  }, [checkSession]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
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
    syncSimulationState(newUser.role, newUser.designation);
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      setUser(null);
      setAccessToken(null);
      // Clean redirect will be handled by components
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
