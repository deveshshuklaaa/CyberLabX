import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Experiment } from '../types/api';

// The list endpoint omits detail-only fields (tasks, quiz, lab and theory).
export type CatalogueExperiment = Pick<Experiment, '_id' | 'title' | 'slug' | 'description' | 'difficulty' | 'estimatedTimeMinutes' | 'category'> & { taskCount: number };
export function useCatalogue() {
  return useQuery({ queryKey: ['experiments'], retry: false, queryFn: async () => {
    const { data } = await api.get<{ experiments: CatalogueExperiment[] }>('/experiments');
    if (!Array.isArray(data?.experiments)) throw new Error('Invalid catalogue response.'); return data;
  } });
}
