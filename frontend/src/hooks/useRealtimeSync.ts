"use client";

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../context/SocketContext';
import { RealtimeEvent } from '../types/realtime';
import { useAuth } from '../context/AuthContext';

export const useRealtimeSync = () => {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleRealtimeEvent = (event: RealtimeEvent) => {
      console.log('Realtime event received on client:', event);

      switch (event.type) {
        case 'ATTENDANCE_UPDATED':
          queryClient.invalidateQueries({ queryKey: ['attendance'] });
          window.dispatchEvent(new Event('realtimeDashboardUpdate'));
          break;

        case 'TEACHING_PLAN_CHANGED':
          queryClient.invalidateQueries({ queryKey: ['teaching-plans'] });
          window.dispatchEvent(new Event('realtimeDashboardUpdate'));
          break;

        case 'NOTIFICATION_EMITTED': {
          const payload = event.payload;
          
          let isRecipient = false;
          
          if (payload.userId && user && payload.userId === user.id) {
            isRecipient = true;
          } else if (!payload.userId && user) {
            const matchesRole = !payload.targetRole || payload.targetRole === user.role;
            
            let matchesDept = true;
            let matchesSem = true;
            
            if (payload.departmentId) {
              const userDeptId = user.departmentId || user.facultyProfile?.departmentId || user.studentProfile?.departmentId;
              matchesDept = userDeptId === payload.departmentId;
            }
            
            if (payload.semester && user.role === 'student' && user.studentProfile) {
              matchesSem = user.studentProfile.semester === payload.semester;
            }
            
            isRecipient = matchesRole && matchesDept && matchesSem;
          }

          if (isRecipient) {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            window.dispatchEvent(new Event('realtimeDashboardUpdate'));
            
            window.dispatchEvent(
              new CustomEvent('newRealtimeNotification', {
                detail: payload,
              })
            );
          }
          break;
        }

        case 'EXAM_SEATING_CHANGED':
          queryClient.invalidateQueries({ queryKey: ['exam-seating'] });
          window.dispatchEvent(new Event('realtimeDashboardUpdate'));
          break;

        default:
          break;
      }
    };

    socket.on('realtime_event', handleRealtimeEvent);

    return () => {
      socket.off('realtime_event', handleRealtimeEvent);
    };
  }, [socket, isConnected, queryClient, user]);
};
