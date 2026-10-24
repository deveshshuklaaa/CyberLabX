import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useSessionStore } from '../store/sessionStore';
const identity = () => { const user = useSessionStore.getState().user; return user ? `${user.id}:${user.role}` : 'anonymous'; };
export function useSessionBootstrap() {
  const { loaded, setUser, setLoaded } = useSessionStore(); const client = useQueryClient();
  useEffect(() => {
    // Tag the local request config, never a header/token, so an old request cannot expire a newer user's session.
    if (!api.interceptors) return;
    const request = api.interceptors.request.use(config => Object.assign(config, { sessionIdentity: identity() }));
    const response = api.interceptors.response.use(value => value, async error => {
      const config = error.config as { url?: string; sessionIdentity?: string } | undefined;
      if (error.response?.status === 401 && !config?.url?.split('?')[0].endsWith('/auth/login') && config?.sessionIdentity === identity()) {
        await client.cancelQueries(); client.clear();
        if (config?.sessionIdentity === identity()) { setUser(null); setLoaded(); }
      }
      return Promise.reject(error);
    });
    return () => { api.interceptors.request.eject(request); api.interceptors.response.eject(response); };
  }, [client, setLoaded, setUser]);
  useEffect(() => {
    if (loaded) return;
    let active = true; const controller = new AbortController();
    api.get('/auth/me', { signal: controller.signal }).then(async ({ data }) => {
      if (!active) return; await client.cancelQueries(); if (!active) return; client.clear(); setUser(data.user);
    }).catch(() => { if (active) { client.clear(); setUser(null); } }).finally(() => { if (active) setLoaded(); });
    return () => { active = false; controller.abort(); };
  }, [loaded, client, setLoaded, setUser]);
}

