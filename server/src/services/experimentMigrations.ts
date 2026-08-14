import { Experiment, NMAP_LAB_DEFINITION } from '../models/Experiment.js';

/*
 * Existing installations may contain the original Nmap experiment from before
 * `lab` was introduced.  This is deliberately narrow and idempotent: it only
 * normalizes CyberLabX's built-in Nmap record and never affects other labs.
 */
export async function migrateLegacyExperimentLabDefinitions() {
  const result = await Experiment.updateOne(
    {
      slug: 'network-mapping-nmap',
      $or: [
        { lab: { $exists: false } },
        { lab: null },
        { 'lab.profile': { $ne: NMAP_LAB_DEFINITION.profile } },
        { 'lab.studentImageKey': { $ne: NMAP_LAB_DEFINITION.studentImageKey } },
        { 'lab.target.imageKey': { $ne: NMAP_LAB_DEFINITION.target.imageKey } },
        { 'lab.target.hostname': { $ne: NMAP_LAB_DEFINITION.target.hostname } },
        { 'lab.target.displayName': { $ne: NMAP_LAB_DEFINITION.target.displayName } },
        { 'lab.terminal.promptLabel': { $ne: NMAP_LAB_DEFINITION.terminal.promptLabel } },
      ],
    },
    { $set: { lab: NMAP_LAB_DEFINITION } },
    { runValidators: true },
  );

  if (result.modifiedCount > 0) console.log('Migrated Nmap experiment lab definition.');
  return result.modifiedCount;
}
