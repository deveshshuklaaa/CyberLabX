import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { LabSession } from '../models/LabSession.js';
import { CommandLog } from '../models/CommandLog.js';
import { getShellStream } from '../services/labEngine.js';
import { authorizeVm } from '../services/vm/access.js';
import { openTerminal } from '../services/vm/manager.js';

/* ------------------------------------------------------------------ */
/*  Per-session terminal state                                        */
/* ------------------------------------------------------------------ */
interface TerminalEntry {
    resize?: (cols: number, rows: number) => void | Promise<unknown>;
    captureRevision: number;
    stream: NodeJS.WritableStream;
    sockets: Set<string>;
    /** Rolling window of recent output (for command-log context). */
    output: string;
    /** Current command buffer — handles backspace / Ctrl-C properly. */
    commandBuf: string;
    /** Timestamp when the user started typing the current command. */
    commandStartedAt: number | null;
    /** The latest server-side command log receiving terminal output. */
    activeCommandLogId?: string;
    outputSinceCommand: string;
    capturingCommandOutput: boolean;
}

const streams = new Map<string, TerminalEntry>();
const joining = new Map<string, Promise<void>>();

/* ------------------------------------------------------------------ */
/*  ANSI escape-sequence stripper                                     */
/*  Removes CSI sequences (arrow keys, cursor movement, color, etc.)  */
/* ------------------------------------------------------------------ */
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][0-9A-Za-z]/g;
const BRACKETED_PASTE_RE = /\x1b\[(?:200|201)~/g;

export function sanitizeTerminalInputForLogging(data: string): string {
    return data.replace(BRACKETED_PASTE_RE, '').replace(ANSI_RE, '');
}

/* ------------------------------------------------------------------ */
/*  Cookie helper                                                     */
/* ------------------------------------------------------------------ */
function cookieValue(cookie = '', name: string) {
    return cookie.split(';').map(item => item.trim())
        .find(item => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

function validSessionId(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

function persistCapturedOutput(item: TerminalEntry) {
    if (!item.activeCommandLogId) return;
    void CommandLog.findByIdAndUpdate(item.activeCommandLogId, {
        $set: { stdout: item.outputSinceCommand.slice(-50_000) },
    }).catch(() => { /* best-effort evidence capture */ });
}

/* ------------------------------------------------------------------ */
/*  Socket.IO terminal attachment                                     */
/* ------------------------------------------------------------------ */
export function attachTerminalSocket(io: Server) {
    /* ── Auth middleware ──────────────────────────────────────────── */
    io.use(async (socket, next) => {
        try {
            if (socket.handshake.headers.origin !== new URL(env.CLIENT_URL).origin) return next(new Error('Unauthorized origin'));
            const token = cookieValue(socket.handshake.headers.cookie, 'cyberlabx_session');
            if (!token) return next(new Error('Unauthorized'));
            const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
            const user = await User.findById(payload.sub);
            if (!user?.isActive || user.role !== 'student') return next(new Error('Unauthorized'));
            socket.data.user = user;
            next();
        } catch {
            next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket: Socket) => {
        /* ── terminal:join ─────────────────────────────────────────── */
        socket.on('terminal:join', async (payload: unknown) => {
          try {
            const labSessionId = (payload as { labSessionId?: unknown })?.labSessionId;
            if (!validSessionId(labSessionId)) {
                return socket.emit('terminal:error', { message: 'Invalid lab session.' });
            }
            const user = socket.data.user;
            const session = await LabSession.findOne({
                _id: labSessionId,
                studentId: user._id,
                status: 'running',
            });
            if (!session || (!session.studentContainerId && !session.vmAttemptId) || session.expiresAt <= new Date()) {
                return socket.emit('terminal:error', { message: 'This lab terminal is unavailable.' });
            }

            const key = String(session._id);
            if (session.vmAttemptId) await authorizeVm(key, String(user._id));
            while (joining.has(key)) await joining.get(key);
            let item = streams.get(key);

            if (!item) {
                let unlock!: () => void;
                joining.set(key, new Promise<void>(resolve => { unlock = resolve; }));
                try {
                    const shell = session.vmAttemptId
                        ? await openTerminal(session.vmAttemptId)
                        : await getShellStream(session.studentContainerId!, session.terminalUser);
                    item = { captureRevision: 0, resize: 'resize' in shell ? shell.resize : undefined, stream: shell.input, sockets: new Set(), output: '', commandBuf: '', commandStartedAt: null, outputSinceCommand: '', capturingCommandOutput: false };
                    streams.set(key, item);
                    if (session.vmAttemptId && 'close' in shell) {
                        const revoke = setInterval(() => {
                            void authorizeVm(key, String(user._id)).catch(() => shell.close());
                        }, 5000);
                        shell.output.once('close', () => clearInterval(revoke));
                    }

                    shell.output.on('data', (data: Buffer) => {
                        const text = data.toString('utf8');
                        item!.output = (item!.output + text).slice(-50_000);
                        if (item!.capturingCommandOutput) {
                            item!.outputSinceCommand = (item!.outputSinceCommand + text).slice(-50_000);
                            persistCapturedOutput(item!);
                        }
                        for (const id of item!.sockets) io.to(id).emit('terminal:output', text);
                    });

                    shell.output.on('end', () => streams.delete(key));
                    shell.output.on('close', () => streams.delete(key));
                    shell.output.on('error', () => streams.delete(key));
                } catch {
                    return socket.emit('terminal:error', { message: 'Unable to attach to the terminal.' });
                } finally {
                    joining.delete(key); unlock();
                }
            }

            item.sockets.add(socket.id);
            socket.join(`lab:${key}`);
            const restored = Boolean(item.output);
            if (restored) socket.emit('terminal:output', item.output);
            socket.emit('terminal:ready', { restored, backend: session.vmAttemptId ? 'qemu' : 'docker' });
          } catch { socket.emit('terminal:error', { message: 'Terminal session is unavailable.' }); }
        });

        socket.on('terminal:resize', async (payload: { labSessionId?: string; cols?: number; rows?: number }) => {
            try {
                if (!validSessionId(payload?.labSessionId) || !Number.isInteger(payload.cols) || !Number.isInteger(payload.rows)) return;
                const item = streams.get(payload.labSessionId);
                if (!item?.sockets.has(socket.id)) return;
                if (!item.resize) return;
                const session = await LabSession.findOne({ _id: payload.labSessionId, studentId: socket.data.user._id, status: 'running' });
                if (!session || session.expiresAt <= new Date()) return;
                if (session.vmAttemptId) await authorizeVm(payload.labSessionId, String(socket.data.user._id));
                await item.resize(Math.min(300, Math.max(20, payload.cols!)), Math.min(150, Math.max(5, payload.rows!)));
            } catch { socket.emit('terminal:error', { message: 'Terminal session is unavailable.' }); }
        });

        /* ── terminal:input ────────────────────────────────────────── */
        let inputQueue: Promise<unknown> = Promise.resolve();
        let queuedInputs = 0;
        socket.on('terminal:input', (payload: unknown) => {
            if (++queuedInputs > 128) { socket.disconnect(true); return; }
            inputQueue = inputQueue.then(() => handleInput(payload)).finally(() => { queuedInputs--; });
        });
        const handleInput = async (payload: unknown) => {
          try {
            if (!socket.connected) return;
            const labSessionId = (payload as { labSessionId?: unknown })?.labSessionId;
            const data = (payload as { data?: unknown })?.data;
            if (!validSessionId(labSessionId)) return socket.emit('terminal:error', { message: 'Invalid lab session.' });
            if (typeof data !== 'string' || data.length > 4096) return;

            const user = socket.data.user;
            const session = await LabSession.findOne({
                _id: labSessionId,
                studentId: user._id,
                status: 'running',
            });
            const item = streams.get(labSessionId);
            if (!session || session.expiresAt <= new Date() || !item || !item.sockets.has(socket.id)) {
                return socket.emit('terminal:error', { message: 'Terminal session is unavailable.' });
            }
            if (session.vmAttemptId) await authorizeVm(labSessionId, String(user._id));

            // Strip ANSI escapes before processing for command logging
            const clean = sanitizeTerminalInputForLogging(data);

            for (const ch of clean) {
                if (ch === '\x03') {
                    // Ctrl+C — discard current command buffer
                    item.commandBuf = '';
                    item.commandStartedAt = null;
                    continue;
                }

                if (ch === '\x7f' || ch === '\b') {
                    // Backspace — remove last character
                    item.commandBuf = item.commandBuf.slice(0, -1);
                    if (item.commandBuf.length === 0) item.commandStartedAt = null;
                    continue;
                }

                if (ch === '\r' || ch === '\n') {
                    // Enter — log the command
                    const command = item.commandBuf.trim();
                    item.commandBuf = '';
                    const startedAt = item.commandStartedAt;
                    item.commandStartedAt = null;

                    if (command && !/(password|token|secret)/i.test(command)) {
                        const durationMs = startedAt ? Date.now() - startedAt : undefined;
                        {
                            item.capturingCommandOutput = true;
                            item.outputSinceCommand = '';
                            item.activeCommandLogId = undefined;
                            const revision = ++item.captureRevision;
                            void CommandLog.create({
                                attemptId: session.attemptId,
                                studentId: user._id,
                                sessionId: session._id,
                                command,
                                stdout: '',
                                stderr: '',
                                durationMs,
                            }).then(log => {
                              if (log && item.captureRevision === revision) {
                                item.activeCommandLogId = String(log._id);
                                persistCapturedOutput(item);
                              }
                            }).catch(() => { /* best-effort logging */ });
                        }
                    }
                    continue;
                }

                // Ignore other control characters (< 0x20) except tab
                if (ch.charCodeAt(0) < 0x20 && ch !== '\t') continue;

                // Normal printable character — append to buffer
                if (item.commandStartedAt === null) item.commandStartedAt = Date.now();
                item.commandBuf = (item.commandBuf + ch).slice(-2000);
            }
            // Arm capture before forwarding: fast commands can reply immediately.
            // The original bytes always reach the PTY, including control sequences.
            item.stream.write(data);
          } catch { socket.emit('terminal:error', { message: 'Terminal session is unavailable.' }); }
        };

        /* ── disconnect ────────────────────────────────────────────── */
        socket.on('disconnect', () => {
            for (const item of streams.values()) item.sockets.delete(socket.id);
        });
    });
}
