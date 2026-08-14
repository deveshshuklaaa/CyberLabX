import { describe, expect, it } from 'vitest';
import { validateTask } from '../services/gradingEngine.js';
import type { Task } from '../models/Experiment.js';

/* ------------------------------------------------------------------ */
/*  Helpers to build task fixtures                                    */
/* ------------------------------------------------------------------ */
function makeTask(overrides: Partial<Task> & { verification: Task['verification'] }): Task {
    return {
        id: 'test-task',
        title: 'Test Task',
        description: '',
        hints: [],
        marks: 10,
        order: 1,
        ...overrides,
    };
}

/* ================================================================== */
/*  command rule                                                      */
/* ================================================================== */
describe('command rule', () => {
    const task = makeTask({
        verification: [{ type: 'command', tool: 'nmap', requiredArgs: ['-sS'] }],
    });

    it('accepts a valid SYN scan command', () => {
        const r = validateTask(task, 'nmap -sS nmap-target');
        expect(r.passed).toBe(true);
        expect(r.score).toBe(10);
        expect(r.ruleResults).toHaveLength(1);
        expect(r.ruleResults[0].type).toBe('command');
        expect(r.ruleResults[0].passed).toBe(true);
    });

    it('rejects when the required flag is missing', () => {
        const r = validateTask(task, 'nmap -sV nmap-target');
        expect(r.passed).toBe(false);
        expect(r.score).toBe(0);
        expect(r.ruleResults[0].passed).toBe(false);
        expect(r.ruleResults[0].message).toContain('-sS');
    });

    it('rejects when the wrong tool is used', () => {
        const r = validateTask(task, 'masscan -sS nmap-target');
        expect(r.passed).toBe(false);
        expect(r.ruleResults[0].message).toContain('nmap');
    });

    it('rejects when no target is specified', () => {
        const r = validateTask(task, 'nmap -sS');
        expect(r.passed).toBe(false);
        expect(r.ruleResults[0].message).toContain('target');
    });

    it('accepts an IP address as target', () => {
        const r = validateTask(task, 'nmap -sS 10.0.0.2');
        expect(r.passed).toBe(true);
    });

    it('does not give SYN-scan credit to a plain Nmap command', () => {
        const r = validateTask(task, 'nmap nmap-target');
        expect(r.passed).toBe(false);
    });
});

/* ================================================================== */
/*  scan_result rule                                                  */
/* ================================================================== */
describe('scan_result rule', () => {
    const task = makeTask({
        verification: [{ type: 'scan_result', requiredPort: 80, requiredState: 'open' }],
    });

    it('passes when port/state is found in output', () => {
        const output = 'PORT     STATE SERVICE\n80/tcp   open  http\n';
        const r = validateTask(task, 'nmap nmap-target', output);
        expect(r.passed).toBe(true);
        expect(r.ruleResults[0].message).toContain('80');
    });

    it('fails when the port is not in the output', () => {
        const output = 'PORT     STATE SERVICE\n443/tcp  open  https\n';
        const r = validateTask(task, 'nmap nmap-target', output);
        expect(r.passed).toBe(false);
    });

    it('fails when output is empty', () => {
        const r = validateTask(task, 'nmap nmap-target', '');
        expect(r.passed).toBe(false);
    });
});

/* ================================================================== */
/*  service_detection rule                                            */
/* ================================================================== */
describe('service_detection rule', () => {
    const task = makeTask({
        verification: [{ type: 'service_detection', requiredService: 'Apache' }],
    });

    it('passes when service is found in output', () => {
        const output = '80/tcp open  http  Apache httpd 2.4.52';
        const r = validateTask(task, 'nmap -sV nmap-target', output);
        expect(r.passed).toBe(true);
        expect(r.ruleResults[0].message).toContain('Apache');
    });

    it('fails when service is not found', () => {
        const output = '80/tcp open  http  nginx 1.22';
        const r = validateTask(task, 'nmap -sV nmap-target', output);
        expect(r.passed).toBe(false);
    });

    it('is case-insensitive', () => {
        const output = '80/tcp open  http  apache httpd 2.4.52';
        const r = validateTask(task, 'nmap -sV nmap-target', output);
        expect(r.passed).toBe(true);
    });

    it('requires -sV or -A rather than accepting plain Nmap output', () => {
        const output = '80/tcp open  http  Apache httpd 2.4.52';
        expect(validateTask(task, 'nmap nmap-target', output).passed).toBe(false);
        expect(validateTask(task, 'nmap -A nmap-target', output).passed).toBe(true);
    });
});

/* ================================================================== */
/*  os_detection rule                                                 */
/* ================================================================== */
describe('os_detection rule', () => {
    const task = makeTask({
        verification: [{ type: 'os_detection' }],
    });

    it('passes when -O flag and OS result present', () => {
        const output = 'OS details: Linux 5.4 - 5.10\nNetwork Distance: 1 hop';
        const r = validateTask(task, 'nmap -O nmap-target', output);
        expect(r.passed).toBe(true);
        expect(r.ruleResults[0].passed).toBe(true);
    });

    it('passes when -A flag and OS result present', () => {
        const output = 'Running: Linux 5.x\nOS CPE: cpe:/o:linux:linux_kernel:5';
        const r = validateTask(task, 'nmap -A nmap-target', output);
        expect(r.passed).toBe(true);
        expect(r.ruleResults[0].passed).toBe(true);
    });

    it('fails when no OS detection flag is used', () => {
        const output = 'OS details: Linux 5.4';
        const r = validateTask(task, 'nmap -sS nmap-target', output);
        expect(r.passed).toBe(false);
        expect(r.ruleResults[0].message).toContain('-O or -A');
    });

    it('fails when no OS result in output despite -O flag', () => {
        const r = validateTask(task, 'nmap -O nmap-target', 'PORT STATE SERVICE\n80/tcp open http');
        expect(r.passed).toBe(false);
    });

    it('fails when no OS result in output despite -A flag', () => {
        const r = validateTask(task, 'nmap -A nmap-target', 'PORT STATE SERVICE\n80/tcp open http');
        expect(r.passed).toBe(false);
    });

    it('treats -A as satisfying an OS command requirement', () => {
        const commandTask = makeTask({ verification: [{ type: 'command', tool: 'nmap', requiredArgs: ['-O'] }] });
        expect(validateTask(commandTask, 'nmap -A nmap-target').passed).toBe(true);
    });
});

/* ================================================================== */
/*  Combined command + output rules                                   */
/* ================================================================== */
describe('combined command + output rules', () => {
    const task = makeTask({
        marks: 20,
        verification: [
            { type: 'command', tool: 'nmap', requiredArgs: ['-sV'] },
            { type: 'service_detection', requiredService: 'http' },
        ],
    });

    it('passes when both command and output rules match', () => {
        const output = '80/tcp open  http  Apache httpd 2.4.52';
        const r = validateTask(task, 'nmap -sV nmap-target', output);
        expect(r.passed).toBe(true);
        expect(r.score).toBe(20);
        expect(r.ruleResults).toHaveLength(2);
        expect(r.ruleResults.every(rr => rr.passed)).toBe(true);
    });

    it('fails when command matches but output does not', () => {
        const r = validateTask(task, 'nmap -sV nmap-target', 'no services');
        expect(r.passed).toBe(false);
        expect(r.ruleResults[0].passed).toBe(true);  // command ok
        expect(r.ruleResults[1].passed).toBe(false);  // service not found
    });

    it('fails when output matches but command does not', () => {
        const output = '80/tcp open  http  Apache httpd 2.4.52';
        const r = validateTask(task, 'nmap -sS nmap-target', output);
        expect(r.passed).toBe(false);
        expect(r.ruleResults[0].passed).toBe(false); // wrong flag
        expect(r.ruleResults[1].passed).toBe(false); // service flag also required
    });
});

/* ================================================================== */
/*  Edge cases                                                        */
/* ================================================================== */
describe('edge cases', () => {
    it('rejects unknown rule type', () => {
        const task = makeTask({
            verification: [{ type: 'nonexistent' as any }],
        });
        const r = validateTask(task, 'nmap nmap-target');
        expect(r.passed).toBe(false);
        expect(r.ruleResults[0].message).toContain('Unknown');
    });

    it('rejects task with no verification rules', () => {
        const task = makeTask({ verification: [] });
        const r = validateTask(task, 'nmap nmap-target');
        expect(r.passed).toBe(false);
    });

    it('returns completion message on success', () => {
        const task = makeTask({
            completionMessage: 'Well done!',
            verification: [{ type: 'command', tool: 'nmap', requiredArgs: ['-sn'] }],
        });
        const r = validateTask(task, 'nmap -sn nmap-target');
        expect(r.feedback).toBe('Well done!');
    });
});
