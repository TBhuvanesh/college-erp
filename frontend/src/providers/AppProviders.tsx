"use client";

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SimulationProvider } from '@/context/SimulationContext';
import { AuthProvider } from '@/context/AuthContext';
import { PermissionProvider } from '@/context/PermissionContext';
import { SocketProvider } from '@/context/SocketContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

function RealtimeSyncListener() {
  useRealtimeSync();
  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SimulationProvider>
        <AuthProvider>
          <SocketProvider>
            <PermissionProvider>
              <RealtimeSyncListener />
              {children}
            </PermissionProvider>
          </SocketProvider>
        </AuthProvider>
      </SimulationProvider>
    </QueryClientProvider>
  );
}
