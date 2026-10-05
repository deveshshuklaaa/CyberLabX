import { describe, expect, it } from 'vitest';
import { sanitizeTerminalInputForLogging } from '../sockets/terminalSocket.js';

describe('terminal input sanitization', () => {
  it('removes bracketed-paste markers before command logging', () => {
    expect(sanitizeTerminalInputForLogging('\x1b[200~nmap -sS nmap-target\r\x1b[201~'))
      .toBe('nmap -sS nmap-target\r');
  });
});
