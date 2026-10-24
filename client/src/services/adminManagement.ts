import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from './api';
import type { Role } from '../types/api';
export interface AdminUser { id: string; firstName: string; lastName: string; email: string; role: Role; isActive: boolean; teacherId: string | null; enrolledAt: string | null; createdAt: string | null; updatedAt: string | null; managementVersion: number | null; }
export interface Management { writesAvailable: boolean; message: string; code: string; }
export interface Page { page: number; limit: number; total: number; }
export interface UserFilters { page: number; limit: number; role?: Role; isActive?: string; email?: string; q?: string; }
export interface AuditFilters { page: number; limit: number; action?: string; actorId?: string; resourceType?: string; resourceId?: string; from?: string; to?: string; }
export interface AdminEvent { id: string; action: string; createdAt: string; actorId: string | null; resource: { type: string | null; id: string | null }; changes: { field: string; before: string | boolean | null; after: string | boolean | null }[]; }
export const blockedAccountMessage = 'Account creation and role/status updates are unavailable. You can review existing accounts and manage teacher assignments.';
export function adminError(error: unknown) {
  if (axios.isAxiosError(error)) {
    switch (error.response?.status) {
      case 401: return 'Your session is unavailable. Sign in again.';
      case 403: return 'Administrator permission is required.';
      case 404: return 'The selected account or assignment is unavailable. Refresh before continuing.';
      case 409: return error.response.data?.code === 'DUPLICATE_EMAIL' ? 'An account with this email already exists. Use the directory to select it.' : error.response.data?.message ?? 'The assignment or account changed. Refresh before trying again.';
      case 503: return blockedAccountMessage;
    }
  }
  return errorMessage(error);
}
export function useAdminUsers(adminId: string, filters: UserFilters) {
  return useQuery({ queryKey: ['admin-users', adminId, filters], retry: false, queryFn: async () => {
    const { data } = await api.get<{ users: AdminUser[]; pagination: Page; management: Management }>('/admin/users', { params: filters });
    if (!Array.isArray(data?.users) || !data.pagination || !data.management) throw new Error('Invalid directory response.'); return data;
  } });
}
export function useAdminUser(adminId: string, userId: string) {
  return useQuery({ queryKey: ['admin-user', adminId, userId], retry: false, queryFn: async () => {
    const { data } = await api.get<{ user: AdminUser; management: Management }>(`/admin/users/${userId}`);
    if (data?.user?.id !== userId || !data.management) throw new Error('Invalid user response.'); return data;
  } });
}
export function useAdminAudit(adminId: string, filters: AuditFilters) {
  return useQuery({ queryKey: ['admin-audit', adminId, filters], retry: false, queryFn: async () => {
    const { data } = await api.get<{ events: AdminEvent[]; pagination: Page }>('/admin/audit-events', { params: filters });
    if (!Array.isArray(data?.events) || !data.pagination) throw new Error('Invalid audit response.'); return data;
  } });
}
export function useRefreshAdmin() {
  const client = useQueryClient();
  return () => Promise.all(['admin-users', 'admin-user', 'admin-cohort', 'admin-student', 'admin-audit', 'admin-dashboard', 'faculty-dashboard', 'student-enrollment', 'teacher-students', 'teacher-student', 'teacher-academics', 'teacher-analytics'].map(key => client.invalidateQueries({ queryKey: [key] })));
}
