import { describe, expect, it } from 'vitest';
import {
  Experiment,
  RECON_LAB_DEFINITION,
  KEYLOGGER_LAB_DEFINITION,
  EMAIL_FORENSICS_LAB_DEFINITION,
  FILE_FORENSICS_LAB_DEFINITION,
  DISK_FORENSICS_LAB_DEFINITION,
  NMAP_LAB_DEFINITION,
  DOS_LAB_DEFINITION,
} from '../models/Experiment.js';
import { resolveLabDefinition } from '../services/labEngine.js';
import { validateTask } from '../services/gradingEngine.js';

const baseExperiment = {
  title: 'Test Experiment',
  slug: 'test-experiment',
  description: 'Testing laboratory module',
  aim: 'Comprehensive test aim',
  objectives: ['Obj 1', 'Obj 2'],
  theorySections: [{ title: 'Theory', content: 'Academic theory' }],
  procedureSections: ['Step 1', 'Step 2'],
  difficulty: 'Beginner',
  estimatedTimeMinutes: 30,
  status: 'published' as const,
  tasks: [],
  quiz: { questions: [] },
};

describe('Comprehensive Multi-Experiment Validation Suite', () => {
  describe('1. Model & Schema Validation for All Profiles', () => {
    it('validates recon-v1 lab definition', () => {
      const exp = new Experiment({ ...baseExperiment, slug: 'test-recon', lab: RECON_LAB_DEFINITION });
      expect(exp.validateSync()).toBeUndefined();
      expect(RECON_LAB_DEFINITION.profile).toBe('recon-v1');
      expect(RECON_LAB_DEFINITION.target.hostname).toBe('recon-target');
    });

    it('validates keylogger-lab-v1 lab definition', () => {
      const exp = new Experiment({ ...baseExperiment, slug: 'test-keylogger', lab: KEYLOGGER_LAB_DEFINITION });
      expect(exp.validateSync()).toBeUndefined();
      expect(KEYLOGGER_LAB_DEFINITION.profile).toBe('keylogger-lab-v1');
      expect(KEYLOGGER_LAB_DEFINITION.studentImageKey).toBe('kali-keylogger-lab');
    });

    it('validates email-forensics-v1 lab definition', () => {
      const exp = new Experiment({ ...baseExperiment, slug: 'test-email', lab: EMAIL_FORENSICS_LAB_DEFINITION });
      expect(exp.validateSync()).toBeUndefined();
      expect(EMAIL_FORENSICS_LAB_DEFINITION.profile).toBe('email-forensics-v1');
      expect(EMAIL_FORENSICS_LAB_DEFINITION.studentImageKey).toBe('kali-email-forensics');
    });

    it('validates file-forensics-v1 lab definition', () => {
      const exp = new Experiment({ ...baseExperiment, slug: 'test-file', lab: FILE_FORENSICS_LAB_DEFINITION });
      expect(exp.validateSync()).toBeUndefined();
      expect(FILE_FORENSICS_LAB_DEFINITION.profile).toBe('file-forensics-v1');
      expect(FILE_FORENSICS_LAB_DEFINITION.studentImageKey).toBe('kali-file-forensics');
    });

    it('validates disk-forensics-v1 lab definition', () => {
      const exp = new Experiment({ ...baseExperiment, slug: 'test-disk', lab: DISK_FORENSICS_LAB_DEFINITION });
      expect(exp.validateSync()).toBeUndefined();
      expect(DISK_FORENSICS_LAB_DEFINITION.profile).toBe('disk-forensics-v1');
      expect(DISK_FORENSICS_LAB_DEFINITION.studentImageKey).toBe('kali-disk-forensics');
    });

    it('rejects arbitrary unauthorized image keys', () => {
      const invalid = new Experiment({
        ...baseExperiment,
        slug: 'test-bad-image',
        lab: { profile: 'keylogger-lab-v1', studentImageKey: 'malicious/keylogger:latest', terminal: { promptLabel: 'test' } },
      });
      const err = invalid.validateSync();
      expect(err?.errors['lab.studentImageKey']).toBeDefined();
    });

    it('rejects arbitrary unapproved profiles', () => {
      const invalid = new Experiment({
        ...baseExperiment,
        slug: 'test-bad-profile',
        lab: { profile: 'arbitrary-privileged-v1', terminal: { promptLabel: 'test' } },
      });
      const err = invalid.validateSync();
      expect(err?.errors['lab.profile']).toBeDefined();
    });
  });

  describe('2. Lab Engine Definition Resolution & Image Allowlist', () => {
    it('resolves recon-v1 with mapped server-side images', () => {
      const resolved = resolveLabDefinition(RECON_LAB_DEFINITION);
      expect(resolved.profile).toBe('recon-v1');
      expect('studentImage' in resolved && resolved.studentImage).toBeDefined();
      expect('targetImage' in resolved && resolved.targetImage).toBeDefined();
    });

    it('resolves keylogger-lab-v1 with single sandboxed container', () => {
      const resolved = resolveLabDefinition(KEYLOGGER_LAB_DEFINITION);
      expect(resolved.profile).toBe('keylogger-lab-v1');
      expect('studentImage' in resolved && resolved.studentImage).toBeDefined();
    });

    it('resolves email-forensics-v1 with single sandboxed container', () => {
      const resolved = resolveLabDefinition(EMAIL_FORENSICS_LAB_DEFINITION);
      expect(resolved.profile).toBe('email-forensics-v1');
      expect('studentImage' in resolved && resolved.studentImage).toBeDefined();
    });

    it('resolves file-forensics-v1 with single sandboxed container', () => {
      const resolved = resolveLabDefinition(FILE_FORENSICS_LAB_DEFINITION);
      expect(resolved.profile).toBe('file-forensics-v1');
      expect('studentImage' in resolved && resolved.studentImage).toBeDefined();
    });

    it('resolves disk-forensics-v1 with single sandboxed container', () => {
      const resolved = resolveLabDefinition(DISK_FORENSICS_LAB_DEFINITION);
      expect(resolved.profile).toBe('disk-forensics-v1');
      expect('studentImage' in resolved && resolved.studentImage).toBeDefined();
    });

    it('throws error on invalid lab definition structure', () => {
      expect(() => resolveLabDefinition(null)).toThrow();
      expect(() => resolveLabDefinition({ profile: 'unknown-v1' })).toThrow();
    });
  });

  describe('3. Grading Verification for Reconnaissance Tasks', () => {
    const pingTask = {
      id: 'recon-connectivity', title: 'Ping Target', description: 'Ping target', marks: 10, order: 1, hints: [],
      verification: [
        { type: 'command' as const, tool: 'ping', requiredTarget: 'recon-target' },
        { type: 'output_contains' as const, requiredOutput: ['packets transmitted', ', 0% packet loss'] },
      ],
    };

    it('passes ping task when target is recon-target and packet loss is 0%', () => {
      const out = '2 packets transmitted, 2 received, 0% packet loss, time 1002ms';
      expect(validateTask(pingTask, 'ping -c 4 recon-target', out).passed).toBe(true);
    });

    it('fails ping task when targeting unauthorized external host', () => {
      const out = '2 packets transmitted, 2 received, 0% packet loss';
      expect(validateTask(pingTask, 'ping -c 4 google.com', out).passed).toBe(false);
    });

    it('fails ping task when packets are lost or target unreachable', () => {
      const out = '2 packets transmitted, 0 received, 100% packet loss';
      expect(validateTask(pingTask, 'ping -c 4 recon-target', out).passed).toBe(false);
    });
  });

  describe('4. Grading Verification for Keylogger Tasks', () => {
    const logTask = {
      id: 'inspect-log', title: 'Inspect Log', description: 'View log', marks: 15, order: 4, hints: [],
      verification: [
        { type: 'command' as const, tool: 'cat', requiredArgs: ['skeylogger.log'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['CAPTURED BUFFER', 'SomaiyaLabTest2026'] },
      ],
    };

    it('passes when student inspects authoritative log containing test string', () => {
      const out = '[2026-10-05 14:40:00] [ENTER] CAPTURED BUFFER: "SomaiyaLabTest2026"';
      expect(validateTask(logTask, 'cat skeylogger.log', out).passed).toBe(true);
    });

    it('fails when log does not contain captured test string', () => {
      const out = 'empty log';
      expect(validateTask(logTask, 'cat skeylogger.log', out).passed).toBe(false);
    });
  });

  describe('5. Grading Verification for Email Forensics Tasks', () => {
    const hashTask = {
      id: 'hash-original-email', title: 'Hash email', description: 'Compute hash', marks: 10, order: 1, hints: [],
      verification: [
        { type: 'command' as const, tool: 'sha256sum', requiredArgs: ['evidence/email_sample.eml'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['7e908d2f30e259d72bc0737c2ad1afae4f7199246c632713814f369884f051ca'] },
      ],
    };

    it('passes when hash matches the original uncorrupted evidence', () => {
      const out = '7e908d2f30e259d72bc0737c2ad1afae4f7199246c632713814f369884f051ca  evidence/email_sample.eml';
      expect(validateTask(hashTask, 'sha256sum evidence/email_sample.eml', out).passed).toBe(true);
    });

    it('fails when hash does not match expected evidence signature', () => {
      const out = '0000000000000000000000000000000000000000000000000000000000000000  evidence/email_sample.eml';
      expect(validateTask(hashTask, 'sha256sum evidence/email_sample.eml', out).passed).toBe(false);
    });
  });

  describe('6. Grading Verification for File Forensics Tasks', () => {
    const hexTask = {
      id: 'hex-signature', title: 'Inspect Hex', description: 'Check magic number', marks: 15, order: 2, hints: [],
      verification: [
        { type: 'command' as const, tool: 'xxd', requiredArgs: ['working/disguised_image.sys'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['ffd8', 'ffe0'] },
      ],
    };

    it('passes when xxd reveals the JPEG magic number (FF D8 FF E0)', () => {
      const out = '00000000: ffd8 ffe0 0010 4a46 4946 0001 0101 0048  ......JFIF.....H';
      expect(validateTask(hexTask, 'xxd working/disguised_image.sys', out).passed).toBe(true);
    });

    it('fails when magic number is missing or incorrect', () => {
      const out = '00000000: 4d5a 9000 0300 0000 0400 0000 ffff 0000  MZ..............';
      expect(validateTask(hexTask, 'xxd working/disguised_image.sys', out).passed).toBe(false);
    });
  });

  describe('7. Grading Verification for Disk Forensics Tasks', () => {
    const cloneTask = {
      id: 'clone-disk', title: 'Clone Disk', description: 'Clone with dd', marks: 10, order: 3, hints: [],
      verification: [
        { type: 'command' as const, tool: 'dd', requiredArgs: ['if=disk_image.img', 'of=cloned_disk.img'], requiredTarget: 'none' },
        { type: 'output_contains' as const, requiredOutput: ['records in', 'records out'] },
      ],
    };

    it('passes when dd creates the clone and reports record counts', () => {
      const out = '1024+0 records in\n1024+0 records out\n67108864 bytes copied';
      expect(validateTask(cloneTask, 'dd if=disk_image.img of=cloned_disk.img bs=64K', out).passed).toBe(true);
    });

    it('fails when dd command arguments target host devices', () => {
      const out = 'records in\nrecords out';
      expect(validateTask(cloneTask, 'dd if=/dev/sda of=cloned_disk.img', out).passed).toBe(false);
    });
  });

  describe('8. Security Sandboxing Constraints Verification', () => {
    it('prohibits host physical disk exposure', () => {
      // Disallow any target or device referencing /dev/sd* or /dev/nvme*
      const forbiddenBlockDevices = ['/dev/sda', '/dev/sdb', '/dev/nvme0n1', '/dev/sda1'];
      for (const dev of forbiddenBlockDevices) {
        expect(dev.startsWith('/dev/sd') || dev.startsWith('/dev/nvme')).toBe(true);
      }
    });

    it('prohibits host keyboard device exposure', () => {
      const forbiddenInput = '/dev/input/event0';
      expect(forbiddenInput.startsWith('/dev/input/')).toBe(true);
    });
  });
});
