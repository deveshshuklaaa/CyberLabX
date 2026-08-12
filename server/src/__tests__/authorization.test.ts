import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mock config/env BEFORE any imports that depend on it              */
/* ------------------------------------------------------------------ */
vi.mock('../config/env.js', () => ({
    env: {
        JWT_SECRET: 'test-secret-that-is-long-enough',
        LAB_MEMORY_MB: 512,
        LAB_CPU_NANOS: 500000000,
        LAB_NETWORK_PREFIX: 'cyberlabx-lab',
        LAB_IMAGE: 'cyberlabx-kali:latest',
        TARGET_IMAGE: 'cyberlabx-target:latest',
        REPORT_DIR: './reports',
        LAB_TTL_MINUTES: 45,
        CLIENT_URL: 'http://localhost:5173',
        BCRYPT_ROUNDS: 10,
        JWT_EXPIRES_IN: '7d',
        SERVER_PORT: 5000,
        MONGO_URI: 'mongodb://localhost:27017/test',
    },
    isProduction: false,
}));

/* ------------------------------------------------------------------ */
/*  Mock Mongoose models and services                                 */
/* ------------------------------------------------------------------ */
vi.mock('../models/Attempt.js', () => ({
    Attempt: { findOne: vi.fn() },
}));
vi.mock('../models/Experiment.js', () => ({
    Experiment: { findById: vi.fn() },
}));
vi.mock('../models/LabSession.js', () => ({
    LabSession: { findOne: vi.fn() },
}));
vi.mock('../models/Report.js', () => ({
    Report: { findOne: vi.fn() },
}));
vi.mock('../models/User.js', () => ({
    User: { findById: vi.fn() },
}));
vi.mock('../services/labEngine.js', () => ({
    cleanupLab: vi.fn(),
    inspectLab: vi.fn(),
    assertDockerReady: vi.fn(),
    provisionLab: vi.fn(),
}));
vi.mock('../services/reportService.js', () => ({
    generateReport: vi.fn(),
}));

import { Attempt } from '../models/Attempt.js';
import { LabSession } from '../models/LabSession.js';
import { Report } from '../models/Report.js';

/* ------------------------------------------------------------------ */
/*  Import controllers under test                                     */
/* ------------------------------------------------------------------ */
import { getAttempt } from '../controllers/attemptController.js';
import { getReport, download } from '../controllers/reportController.js';
import { getLab } from '../controllers/labController.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function mockReqRes(params: Record<string, string> = {}, userId = 'student-A') {
    const user: any = { _id: userId };
    const req: any = { params, user, cookies: {} };
    const res: any = {
        statusCode: 200,
        body: null as any,
        status(code: number) { res.statusCode = code; return res; },
        json(data: any) { res.body = data; return res; },
        download: vi.fn(),
    };
    const next = vi.fn();
    return { req, res, next };
}

/* ================================================================== */
/*  Student ownership / authorization                                 */
/* ================================================================== */
describe('student ownership — attempt', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 404 when attempt belongs to another student', async () => {
        (Attempt.findOne as Mock).mockReturnValue({
            populate: vi.fn().mockResolvedValue(null),
        });

        const { req, res, next } = mockReqRes({ id: 'attempt-X' }, 'other-student');
        await (getAttempt as any)(req, res, next);

        expect(res.statusCode).toBe(404);
    });
});

describe('student ownership — report', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 404 when report belongs to another student', async () => {
        (Report.findOne as Mock).mockResolvedValue(null);

        const { req, res, next } = mockReqRes({ id: 'report-X' }, 'other-student');
        await (getReport as any)(req, res, next);

        expect(res.statusCode).toBe(404);
    });

    it('returns 404 when trying to download another student report', async () => {
        (Report.findOne as Mock).mockResolvedValue(null);

        const { req, res, next } = mockReqRes({ id: 'report-Y' }, 'other-student');
        await (download as any)(req, res, next);

        expect(res.statusCode).toBe(404);
        expect(res.download).not.toHaveBeenCalled();
    });
});

describe('student ownership — lab session', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 404 when lab session belongs to another student', async () => {
        (LabSession.findOne as Mock).mockResolvedValue(null);

        const { req, res, next } = mockReqRes({ id: 'session-Z' }, 'other-student');
        await (getLab as any)(req, res, next);

        expect(res.statusCode).toBe(404);
    });
});
