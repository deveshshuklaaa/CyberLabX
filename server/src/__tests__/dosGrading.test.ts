import { describe, expect, it } from 'vitest';
import { Experiment, DOS_LAB_DEFINITION } from '../models/Experiment.js';
import { validateTask } from '../services/gradingEngine.js';

describe('Experiment 2 definition and evidence rules', () => {
  it('accepts only the approved three-resource DoS definition', () => {
    const experiment = new Experiment({ title: 'DoS', slug: 'dos-test', description: 'd', aim: 'a', objectives: [], theorySections: [], procedureSections: [], difficulty: 'Intermediate', estimatedTimeMinutes: 40, status: 'published', lab: DOS_LAB_DEFINITION, tasks: [], quiz: { questions: [] } });
    expect(experiment.validateSync()).toBeUndefined();
    const invalid = new Experiment({ ...experiment.toObject(), slug: 'bad-dos', lab: { ...DOS_LAB_DEFINITION, resources: [{ ...DOS_LAB_DEFINITION.resources[0], imageKey: 'untrusted-image' }] } });
    expect(invalid.validateSync()).toBeDefined();
  });

  it('requires actual bounded completion evidence and rejects arbitrary destinations', () => {
    const task = { id: 'syn', title: 'SYN', description: '', hints: [], marks: 20, order: 1, verification: [{ type: 'bounded_network_activity' as const, tool: 'dos-sim' }] };
    expect(validateTask(task, 'dos-sim', 'CONTROLLED_SYN_COMPLETE target=victim count=60 rate=10pps').passed).toBe(true);
    expect(validateTask(task, 'dos-sim 10.0.0.9', 'CONTROLLED_SYN_COMPLETE target=victim count=60 rate=10pps').passed).toBe(false);
    expect(validateTask(task, 'dos-sim', 'attack successful').passed).toBe(false);
  });

  it('requires server-captured tshark indicators for packet analysis', () => {
    const task = { id: 'capture', title: 'Capture', description: '', hints: [], marks: 20, order: 1, verification: [{ type: 'packet_analysis' as const, tool: 'tshark', requiredOutput: ['victim', 'syn', 'packet-rate spike'] }] };
    expect(validateTask(task, 'tshark -i eth0 -Y tcp.flags.syn', 'victim SYN packet-rate spike').passed).toBe(true);
    expect(validateTask(task, 'echo victim SYN packet-rate spike', 'victim SYN packet-rate spike').passed).toBe(false);
  });
});
