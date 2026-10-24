import type { AssessmentScore } from '../types/api';
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function recordedPoints(status: string, score: number | null | undefined) { return status === 'completed' && finite(score) ? score : null; }
export function scoreText(status: string, raw: number | null | undefined, score?: AssessmentScore) {
  const value = recordedPoints(status, score?.value ?? raw);
  if (value === null) return 'Not graded';
  if (!score || !finite(score.max) || score.max < value) return `${value} points · maximum unknown`;
  return `${value} / ${score.max}${score.max > 0 && finite(score.percentage) ? ` (${score.percentage}%)` : ''}`;
}
