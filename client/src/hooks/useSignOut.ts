import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useSessionStore } from '../store/sessionStore';
export function useSignOut() {
  const client = useQueryClient(), navigate = useNavigate();
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const signOut = async () => {
    if (pending) return; setPending(true); setError('');
    try {
      await api.post('/auth/logout'); await client.cancelQueries(); client.clear(); useSessionStore.getState().setUser(null); navigate('/login', { replace: true });
    } catch { setError('Sign out could not be confirmed. Your server session may still be active. Check your connection and try again.'); }
    finally { setPending(false); }
  };
  return { signOut, pending, error };
}
