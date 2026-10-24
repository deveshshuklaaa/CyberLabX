import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Experiment } from '../types/api';

// The list endpoint omits detail-only fields (tasks, quiz, lab and theory).
export type CatalogueExperiment = Pick<Experiment, '_id' | 'title' | 'slug' | 'description' | 'difficulty' | 'estimatedTimeMinutes' | 'category'> & { taskCount: number };
export function useCatalogue() {
  return useQuery({ queryKey: ['experiments'], queryFn: () => api.get<{ experiments: CatalogueExperiment[] }>('/experiments').then(response => response.data) });
}
