import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { LabSession } from '../models/LabSession.js';
import { Attempt } from '../models/Attempt.js';
import { CommandLog } from '../models/CommandLog.js';
import { getShellStream } from '../services/labEngine.js';

/* ------------------------------------------------------------------ */
/*  Per-session terminal state                                        */
/* ------------------------------------------------------------------ */
interface TerminalEntry {
    stream: NodeJS.ReadWriteStream;
    sockets: Set<string>;
    /** Rolling window of recent output (for command-log context). */
    output: string;
    /** Current command buffer — handles backspace / Ctrl-C properly. */
    commandBuf: string;
    /** Timestamp when the user started typing the current command. */
    commandStartedAt: number | null;
}

const streams = new Map<string, TerminalEntry>();

/* ------------------------------------------------------------------ */
/*  ANSI escape-sequence stripper                                     */
/*  Removes CSI sequences (arrow keys, cursor movement, color, etc.)  */
/* ------------------------------------------------------------------ */
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][0-9A-Za-z]/g;

function stripAnsi(data: string): string {
    return data.replace(ANSI_RE, '');
}

/* ------------------------------------------------------------------ */
/*  Cookie helper                                                     */
/* ------------------------------------------------------------------ */
function cookieValue(cookie = '', name: string) {
    return cookie.split(';').map(item => item.trim())
        .find(item => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

/* ------------------------------------------------------------------ */
/*  Socket.IO terminal attachment                                     */
/* ------------------------------------------------------------------ */
export function attachTerminalSocket(io: Server) {
    /* ── Auth middleware ──────────────────────────────────────────── */
    io.use(async (socket, next) => {
        try {
            const token = cookieValue(socket.handshake.headers.cookie, 'cyberlabx_session');
            if (!token) return next(new Error('Unauthorized'));
            const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
            const user = await User.findById(payload.sub);
            if (!user?.isActive) return next(new Error('Unauthorized'));
            socket.data.user = user;
            next();
        } catch {
            next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket: Socket) => {
        /* ── terminal:join ─────────────────────────────────────────── */
        socket.on('terminal:join', async ({ labSessionId }: { labSessionId: string }) => {
            const user = socket.data.user;
            const session = await LabSession.findOne({
                _id: labSessionId,
                studentId: user._id,
                status: 'running',
            });
            if (!session?.studentContainerId) {
                return socket.emit('terminal:error', { message: 'This lab terminal is unavailable.' });
            }

            const key = String(session._id);
            let item = streams.get(key);

            if (!item) {
                try {
                    const stream = await getShellStream(session.studentContainerId);
                    item = { stream, sockets: new Set(), output: '', commandBuf: '', commandStartedAt: null };
                    streams.set(key, item);

                    stream.on('data', (data: Buffer) => {
                        const text = data.toString('utf8');
                        item!.output = (item!.output + text).slice(-50_000);
                        for (const id of item!.sockets) io.to(id).emit('terminal:output', text);
                    });

                    stream.on('close', () => streams.delete(key));
                } catch {
                    return socket.emit('terminal:error', { message: 'Unable to attach to the terminal.' });
                }
            }

            item.sockets.add(socket.id);
            socket.join(`lab:${key}`);
            socket.emit('terminal:ready');
        });

        /* ── terminal:input ────────────────────────────────────────── */
        socket.on('terminal:input', async ({ labSessionId, data }: { labSessionId: string; data: string }) => {
            if (typeof data !== 'string' || data.length > 4096) return;

            const user = socket.data.user;
            const session = await LabSession.findOne({
                _id: labSessionId,
                studentId: user._id,
                status: 'running',
            });
            const item = streams.get(labSessionId);
            if (!session || !item) {
                return socket.emit('terminal:error', { message: 'Terminal session is unavailable.' });
            }

            // Always forward raw data to the container (preserves xterm.js behavior)
            item.stream.write(data);

            // Strip ANSI escapes before processing for command logging
            const clean = stripAnsi(data);

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
                        const attempt = await Attempt.findById(session.attemptId);
                        if (attempt) {
                            await CommandLog.create({
                                attemptId: attempt._id,
                                studentId: user._id,
                                sessionId: session._id,
                                command,
                                stdout: item.output.slice(-10_000),
                                stderr: '',
                                durationMs,
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
        });

        /* ── disconnect ────────────────────────────────────────────── */
        socket.on('disconnect', () => {
            for (const item of streams.values()) item.sockets.delete(socket.id);
        });
    });
}
