import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (value?: any) => void>,
  write: vi.fn(),
  socketEmit: vi.fn(),
}));

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    write = mocks.write;
    loadAddon() {}
    open() {}
    onData() { return { dispose() {} }; }
    dispose() {}
  },
}));

vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} } }));
vi.mock('socket.io-client', () => ({
  io: () => ({
    on(event: string, handler: (value?: any) => void) { mocks.handlers[event] = handler; },
    emit: mocks.socketEmit,
    disconnect() {},
  }),
}));

import { Terminal } from '../components/terminal/Terminal';

describe('Terminal lab metadata', () => {
  it('shows the experiment target hostname in the connection banner', () => {
    render(<Terminal labSessionId="lab-1" targetHostname="configured-target" onOutput={() => {}} />);

    mocks.handlers['terminal:ready']({ restored: false });

    expect(mocks.write).toHaveBeenCalledWith(expect.stringContaining('configured-target'));
    expect(mocks.write).not.toHaveBeenCalledWith(expect.stringContaining('nmap-target'));
  });
});
