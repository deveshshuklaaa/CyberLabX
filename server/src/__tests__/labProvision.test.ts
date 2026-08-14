import { describe, expect, it, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mock config/env BEFORE any imports that depend on it              */
/* ------------------------------------------------------------------ */
vi.mock('../config/env.js', () => ({
    env: {
        LAB_MEMORY_MB: 512,
        LAB_CPU_NANOS: 500000000,
        LAB_NETWORK_PREFIX: 'cyberlabx-lab',
        LAB_IMAGE: 'cyberlabx-kali:latest',
        TARGET_IMAGE: 'cyberlabx-target:latest',
        REPORT_DIR: './reports',
        LAB_TTL_MINUTES: 45,
        DOCKER_HOST: '',
    },
}));

/* ------------------------------------------------------------------ */
/*  Mock Dockerode — capture createContainer calls                    */
/* ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
    mockPing: vi.fn().mockResolvedValue('OK'),
    mockCreateNetwork: vi.fn(),
    mockCreateContainer: vi.fn(),
    mockGetContainer: vi.fn(),
    mockRemove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('dockerode', () => ({
    default: vi.fn().mockImplementation(() => ({
        ping: mocks.mockPing,
        createNetwork: mocks.mockCreateNetwork,
        createContainer: mocks.mockCreateContainer,
        getContainer: mocks.mockGetContainer,
    })),
}));

vi.mock('../models/LabSession.js', () => ({ LabSession: { find: vi.fn() } }));
vi.mock('../models/Attempt.js', () => ({ Attempt: { updateMany: vi.fn() } }));

import { provisionLab } from '../services/labEngine.js';

const nmapLab = {
    profile: 'shell-target-v1',
    studentImageKey: 'kali-nmap',
    target: { imageKey: 'nmap-http-target', hostname: 'nmap-target', displayName: 'Controlled Nmap target' },
    terminal: { promptLabel: 'kali@student-lab' },
} as const;

/* ================================================================== */
/*  Helper: build a fake network name from attemptId                  */
/* ================================================================== */
function fakeNetworkName(attemptId: string) {
    const tag = attemptId.replace(/[^a-zA-Z0-9_.-]/g, '').slice(-24);
    return `cyberlabx-lab-${tag}`;
}

/* ================================================================== */
/*  Regression: target container must receive NET_BIND_SERVICE        */
/* ================================================================== */
describe('provisionLab — container capabilities (regression)', () => {
    let capturedCalls: Record<string, unknown>[] = [];

    beforeEach(() => {
        vi.clearAllMocks();
        capturedCalls = [];

        /* createNetwork returns a mock network */
        mocks.mockCreateNetwork.mockResolvedValue({
            id: 'mock-network-id',
            remove: mocks.mockRemove,
        });

        /*
         * createContainer must return something with .id, .start(), .inspect(),
         * and .remove() — provisionLab calls target.inspect() directly (not
         * through docker.getContainer) to grab the target IP.
         */
        mocks.mockCreateContainer.mockImplementation((opts: Record<string, unknown>) => {
            capturedCalls.push(opts);
            const netName = (opts as any).HostConfig?.NetworkMode ?? 'unknown';
            return {
                id: `container-${capturedCalls.length}`,
                start: vi.fn().mockResolvedValue(undefined),
                inspect: vi.fn().mockResolvedValue({
                    Name: `/cyberlabx-${capturedCalls.length}`,
                    State: { Running: true, Health: { Status: 'healthy' } },
                    NetworkSettings: {
                        Networks: {
                            [netName]: { IPAddress: '172.20.0.2' },
                        },
                    },
                }),
                remove: mocks.mockRemove,
            };
        });

        /*
         * docker.getContainer() is used by waitForHealthy() to poll health
         * status. Return healthy immediately.
         */
        mocks.mockGetContainer.mockReturnValue({
            inspect: vi.fn().mockResolvedValue({
                Name: '/cyberlabx-target-mock',
                State: { Running: true, Health: { Status: 'healthy' } },
                NetworkSettings: { Networks: {} },
            }),
            remove: mocks.mockRemove,
        });
    });

    it('gives the target container NET_BIND_SERVICE, not NET_RAW', async () => {
        await provisionLab({ attemptId: 'testAttempt123', studentId: 'student1', lab: nmapLab });

        expect(capturedCalls.length).toBe(2);

        /* First container created is the TARGET */
        const targetConfig = capturedCalls[0] as any;
        expect(targetConfig.Image).toBe('cyberlabx-target:latest');
        expect(targetConfig.HostConfig.CapDrop).toEqual(['ALL']);
        expect(targetConfig.HostConfig.CapAdd).toEqual(['NET_BIND_SERVICE', 'SETUID', 'SETGID']);
        expect(targetConfig.HostConfig.CapAdd).not.toContain('NET_RAW');

        /* Second container created is the STUDENT */
        const studentConfig = capturedCalls[1] as any;
        expect(studentConfig.Image).toBe('cyberlabx-kali:latest');
        expect(studentConfig.HostConfig.CapDrop).toEqual(['ALL']);
        expect(studentConfig.HostConfig.CapAdd).toEqual(['NET_RAW']);
        expect(studentConfig.HostConfig.CapAdd).not.toContain('NET_BIND_SERVICE');
    });

    it('both containers share security hardening settings', async () => {
        await provisionLab({ attemptId: 'testAttempt456', studentId: 'student2', lab: nmapLab });

        for (const config of capturedCalls) {
            const hc = (config as any).HostConfig;
            expect(hc.PidsLimit).toBe(128);
            expect(hc.Memory).toBe(512 * 1024 * 1024);
            expect(hc.NanoCpus).toBe(500000000);
            expect(hc.SecurityOpt).toEqual(['no-new-privileges:true']);
            expect(hc.CapDrop).toEqual(['ALL']);
        }
    });

    it('target and student containers are on the same private network', async () => {
        const attemptId = 'netTestAttempt';
        await provisionLab({ attemptId, studentId: 'student3', lab: nmapLab });

        const expected = fakeNetworkName(attemptId);
        for (const config of capturedCalls) {
            expect((config as any).HostConfig.NetworkMode).toBe(expected);
        }
    });

    it('rejects unsupported image keys before creating Docker resources', async () => {
        await expect(provisionLab({
            attemptId: 'bad-image',
            studentId: 'student4',
            lab: { ...nmapLab, studentImageKey: 'untrusted-image' } as any,
        })).rejects.toThrow('unsupported image key');

        expect(mocks.mockCreateNetwork).not.toHaveBeenCalled();
        expect(mocks.mockCreateContainer).not.toHaveBeenCalled();
    });

    it('rejects a missing lab definition before creating Docker resources', async () => {
        await expect(provisionLab({
            attemptId: 'missing-lab',
            studentId: 'student5',
            lab: undefined as any,
        })).rejects.toThrow('missing a valid lab definition');

        expect(mocks.mockCreateNetwork).not.toHaveBeenCalled();
        expect(mocks.mockCreateContainer).not.toHaveBeenCalled();
    });
});

/* ================================================================== */
/*  waitForHealthy — diagnostic error messages                        */
/* ================================================================== */
describe('provisionLab — waitForHealthy diagnostics', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.mockCreateNetwork.mockResolvedValue({
            id: 'mock-network-id',
            remove: mocks.mockRemove,
        });

        mocks.mockCreateContainer.mockReturnValue({
            id: 'target-container-1',
            start: vi.fn().mockResolvedValue(undefined),
            inspect: vi.fn().mockResolvedValue({
                Name: '/cyberlabx-target-diag',
                State: { Running: true, Health: { Status: 'healthy' } },
                NetworkSettings: { Networks: {} },
            }),
            remove: mocks.mockRemove,
        });
    });

    it('includes exit code and container name when container exits', async () => {
        /* waitForHealthy uses docker.getContainer(id).inspect() */
        mocks.mockGetContainer.mockReturnValue({
            inspect: vi.fn().mockResolvedValue({
                Name: '/cyberlabx-target-deadbeef',
                State: {
                    Running: false,
                    ExitCode: 1,
                    Health: {
                        Status: 'starting',
                        Log: [{ Output: 'nc: connection refused\n' }],
                    },
                },
            }),
            remove: mocks.mockRemove,
        });

        await expect(
            provisionLab({ attemptId: 'deadbeef', studentId: 's1', lab: nmapLab })
        ).rejects.toThrow(/ExitCode=1/);
    });

    it('includes health log when container is unhealthy', async () => {
        let inspectCount = 0;
        mocks.mockGetContainer.mockReturnValue({
            inspect: vi.fn().mockImplementation(async () => {
                inspectCount++;
                if (inspectCount <= 2) {
                    return {
                        Name: '/cyberlabx-target-abc',
                        State: { Running: true, Health: { Status: 'starting', Log: [] } },
                    };
                }
                return {
                    Name: '/cyberlabx-target-abc',
                    State: {
                        Running: true,
                        Health: {
                            Status: 'unhealthy',
                            Log: [{ Output: 'nc -z 127.0.0.1 80 FAILED\n' }],
                        },
                    },
                };
            }),
            remove: mocks.mockRemove,
        });

        await expect(
            provisionLab({ attemptId: 'abc', studentId: 's1', lab: nmapLab })
        ).rejects.toThrow(/unhealthy.*nc -z 127\.0\.0\.1 80 FAILED/);
    });
});
