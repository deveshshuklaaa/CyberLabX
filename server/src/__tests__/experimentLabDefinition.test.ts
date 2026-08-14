import { describe, expect, it } from 'vitest';
import { Experiment } from '../models/Experiment.js';

const baseExperiment = {
  title: 'Test lab', slug: 'test-lab', description: 'Test', aim: 'Test',
  objectives: [], theorySections: [], procedureSections: [], difficulty: 'Beginner',
  estimatedTimeMinutes: 1, status: 'published' as const, tasks: [], quiz: { questions: [] },
};

const nmapLab = {
  profile: 'shell-target-v1',
  studentImageKey: 'kali-nmap',
  target: { imageKey: 'nmap-http-target', hostname: 'nmap-target', displayName: 'Controlled Nmap target' },
  terminal: { promptLabel: 'kali@student-lab' },
};

describe('Experiment lab definition', () => {
  it('accepts the Nmap lab definition stored with the experiment', () => {
    expect(new Experiment({ ...baseExperiment, lab: nmapLab }).validateSync()).toBeUndefined();
  });

  it('rejects unknown image keys before they can reach provisioning', () => {
    const error = new Experiment({
      ...baseExperiment,
      lab: { ...nmapLab, studentImageKey: 'external-registry/image:latest' },
    }).validateSync();

    expect(error?.errors['lab.studentImageKey']).toBeDefined();
  });

  it('rejects an invalid target hostname', () => {
    const error = new Experiment({
      ...baseExperiment,
      lab: { ...nmapLab, target: { ...nmapLab.target, hostname: 'target name with spaces' } },
    }).validateSync();

    expect(error?.errors['lab.target.hostname']).toBeDefined();
  });
});
