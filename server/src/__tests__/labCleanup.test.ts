import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';

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
/*  Mock Dockerode — use vi.hoisted so mocks are available in factory */
/* ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
    mockRemove: vi.fn(),
    mockListContainers: vi.fn(),
    mockListNetworks: vi.fn(),
    mockGetContainer: vi.fn(),
    mockGetNetwork: vi.fn(),
}));

// Wire return values
mocks.mockGetContainer.mockReturnValue({ remove: mocks.mockRemove });
mocks.mockGetNetwork.mockReturnValue({ remove: mocks.mockRemove });

vi.mock('dockerode', () => ({
    default: vi.fn().mockImplementation(() => ({
        ping: vi.fn().mockResolvedValue('OK'),
        getContainer: mocks.mockGetContainer,
        getNetwork: mocks.mockGetNetwork,
        listContainers: mocks.mockListContainers,
        listNetworks: mocks.mockListNetworks,
    })),
}));

vi.mock('../models/LabSession.js', () => ({
    LabSession: { find: vi.fn() },
}));

vi.mock('../models/Attempt.js', () => ({
    Attempt: { updateMany: vi.fn() },
}));

import { cleanupLab, recoverOrphanedLabs } from '../services/labEngine.js';
import { LabSession } from '../models/LabSession.js';
import { Attempt } from '../models/Attempt.js';

/* ================================================================== */
/*  cleanupLab                                                        */
/* ================================================================== */
describe('cleanupLab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockRemove.mockResolvedValue(undefined);
        mocks.mockGetContainer.mockReturnValue({ remove: mocks.mockRemove });
        mocks.mockGetNetwork.mockReturnValue({ remove: mocks.mockRemove });
    });

    it('removes containers and network', async () => {
        await cleanupLab({
            studentContainerId: 'stu-1',
            targetContainerId: 'tgt-1',
            networkName: 'net-1',
        });

        expect(mocks.mockGetContainer).toHaveBeenCalledWith('stu-1');
        expect(mocks.mockGetContainer).toHaveBeenCalledWith('tgt-1');
        expect(mocks.mockGetNetwork).toHaveBeenCalledWith('net-1');
        expect(mocks.mockRemove).toHaveBeenCalledTimes(3);
    });

    it('is idempotent — handles already-removed resources', async () => {
        mocks.mockGetContainer.mockReturnValue({
            remove: vi.fn().mockRejectedValue(new Error('no such container')),
        });
        mocks.mockGetNetwork.mockReturnValue({
            remove: vi.fn().mockRejectedValue(new Error('no such network')),
        });

        await expect(cleanupLab({
            studentContainerId: 'gone-1',
            targetContainerId: 'gone-2',
            networkName: 'gone-net',
        })).resolves.toBeUndefined(); // no throw
    });

    it('handles partial session data (missing fields)', async () => {
        await expect(cleanupLab({})).resolves.toBeUndefined();
        expect(mocks.mockGetContainer).not.toHaveBeenCalled();
        expect(mocks.mockGetNetwork).not.toHaveBeenCalled();
    });
});

/* ================================================================== */
/*  recoverOrphanedLabs                                               */
/* ================================================================== */
describe('recoverOrphanedLabs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockRemove.mockResolvedValue(undefined);
        mocks.mockGetContainer.mockReturnValue({ remove: mocks.mockRemove });
        mocks.mockGetNetwork.mockReturnValue({ remove: mocks.mockRemove });
        mocks.mockListContainers.mockResolvedValue([]);
        mocks.mockListNetworks.mockResolvedValue([]);
        (Attempt.updateMany as Mock).mockResolvedValue({});
    });

    it('marks stale provisioning sessions as failed', async () => {
        const staleSession: any = {
            _id: 's1',
            attemptId: 'a1',
            status: 'provisioning',
            studentContainerId: 'c1',
            targetContainerId: 'c2',
            networkName: 'n1',
            endedAt: undefined,
            failureReason: undefined,
            save: vi.fn(),
        };
        (LabSession.find as Mock)
            .mockResolvedValueOnce([staleSession])   // stale sessions
            .mockResolvedValueOnce([]);              // active sessions

        const count = await recoverOrphanedLabs();

        expect(count).toBe(1);
        expect(staleSession.status).toBe('failed');
        expect(staleSession.failureReason).toContain('restart');
        expect(staleSession.save).toHaveBeenCalled();
        expect(Attempt.updateMany).toHaveBeenCalled();
    });

    it('marks stale running sessions as expired', async () => {
        const staleSession: any = {
            _id: 's2',
            attemptId: 'a2',
            status: 'running',
            save: vi.fn(),
        };
        (LabSession.find as Mock)
            .mockResolvedValueOnce([staleSession])
            .mockResolvedValueOnce([]);

        await recoverOrphanedLabs();
        expect(staleSession.status).toBe('expired');
    });

    it('removes orphaned Docker containers not linked to active sessions', async () => {
        (LabSession.find as Mock)
            .mockResolvedValueOnce([])  // no stale sessions
            .mockResolvedValueOnce([]); // no active sessions

        mocks.mockListContainers.mockResolvedValue([
            { Id: 'orphan-container', Labels: { 'com.cyberlabx.managed': 'true', 'com.cyberlabx.attempt': 'dead-attempt' } },
        ]);
        mocks.mockListNetworks.mockResolvedValue([
            { Id: 'orphan-network', Labels: { 'com.cyberlabx.managed': 'true', 'com.cyberlabx.attempt': 'dead-attempt' } },
        ]);

        await recoverOrphanedLabs();

        expect(mocks.mockGetContainer).toHaveBeenCalledWith('orphan-container');
        expect(mocks.mockGetNetwork).toHaveBeenCalledWith('orphan-network');
    });

    it('does not fail when Docker is unavailable', async () => {
        (LabSession.find as Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        mocks.mockListContainers.mockRejectedValue(new Error('connection refused'));

        await expect(recoverOrphanedLabs()).resolves.toBe(0);
    });
});
