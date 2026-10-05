import { describe, expect, it } from 'vitest';
import { vmExperiment } from '../services/vm/experiments.js';
import type { IExperiment, LabProfile } from '../models/Experiment.js';

describe('VM curriculum view', () => {
  it.each(['recon-v1', 'dos-analysis-v1', 'keylogger-lab-v1', 'email-forensics-v1', 'file-forensics-v1', 'disk-forensics-v1'] as LabProfile[])(
    '%s uses genuine tools without mutating stored definitions', profile => {
      const original = { lab: { profile, terminal: { promptLabel: 'old' } }, tasks: [], procedureSections: ['old'] } as unknown as IExperiment;
      const adapted = vmExperiment(original);
      expect(adapted.tasks.length).toBeGreaterThan(0);
      expect(JSON.stringify(adapted.tasks)).not.toMatch(/lab-test-input|forensic-recover|dos-sim|"tool":"recon-osint"/);
      expect(adapted.lab.terminal.promptLabel).toContain('somaiya');
      expect(original.procedureSections).toEqual(['old']);
      expect(original.lab.terminal.promptLabel).toBe('old');
    });
});
