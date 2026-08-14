import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../models/Experiment.js', () => ({
  Experiment: { updateOne: vi.fn() },
  NMAP_LAB_DEFINITION: {
    profile: 'shell-target-v1',
    studentImageKey: 'kali-nmap',
    target: { imageKey: 'nmap-http-target', hostname: 'nmap-target', displayName: 'Controlled target' },
    terminal: { promptLabel: 'kali@student-lab' },
  },
}));

import { Experiment, NMAP_LAB_DEFINITION } from '../models/Experiment.js';
import { migrateLegacyExperimentLabDefinitions } from '../services/experimentMigrations.js';

describe('legacy experiment lab migration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('backfills and normalizes only the built-in Nmap experiment', async () => {
    (Experiment.updateOne as Mock).mockResolvedValue({ modifiedCount: 1 });

    await expect(migrateLegacyExperimentLabDefinitions()).resolves.toBe(1);

    expect(Experiment.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'network-mapping-nmap' }),
      { $set: { lab: NMAP_LAB_DEFINITION } },
      { runValidators: true },
    );
  });

  it('is safe to run repeatedly after the data is migrated', async () => {
    (Experiment.updateOne as Mock).mockResolvedValue({ modifiedCount: 0 });

    await expect(migrateLegacyExperimentLabDefinitions()).resolves.toBe(0);
  });
});
