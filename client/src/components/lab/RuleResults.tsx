import { Check, X } from 'lucide-react';
import type { RuleResult } from '../../types/api';

const RULE_LABELS: Record<string, string> = { command: 'Command', scan_result: 'Scan Result', service_detection: 'Service Detection', os_detection: 'OS Detection' };
interface Props { ruleResults: RuleResult[]; feedback?: string; }

export function RuleResults({ ruleResults, feedback }: Props) {
  if (ruleResults.length === 0 && !feedback) return null;
  return <div aria-live="polite" data-testid="rule-results" className="mt-3 space-y-2">
    {ruleResults.map((rule, index) => <div key={index} data-testid="rule-result-item" className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${rule.passed ? 'border-success/30 bg-success/10 text-ink' : 'border-danger/30 bg-danger/10 text-danger'}`}>
      {rule.passed ? <Check size={15} className="mt-0.5 shrink-0 text-success" /> : <X size={15} className="mt-0.5 shrink-0 text-danger" />}
      <div><span className="font-medium">{RULE_LABELS[rule.type] ?? rule.type}:</span>{' '}{rule.message}</div>
    </div>)}
    {feedback && <p data-testid="task-feedback" className="mt-2 text-sm font-medium text-brand">{feedback}</p>}
  </div>;
}
