import type { Role } from '../types/api';

export function roleHome(role: Role) {
  return role === 'admin' ? '/admin' : role === 'faculty' ? '/teacher' : '/student';
}
