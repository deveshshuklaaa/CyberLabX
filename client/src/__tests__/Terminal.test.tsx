import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (value?: any) => void>,
  write: vi.fn(),
  socketEmit: vi.fn(),
  input: undefined as undefined | ((value: string) => void),
  fit: vi.fn(), disconnect: vi.fn(), dispose: vi.fn(), inputDispose: vi.fn(),

}));

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    write = mocks.write;
    loadAddon() {}
    open() {}
    onData(handler: (value: string) => void) { mocks.input = handler; return { dispose: mocks.inputDispose }; }
    dispose = mocks.dispose;
  },
}));

vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit = mocks.fit; } }));
vi.mock('socket.io-client', () => ({
  io: () => ({
    on(event: string, handler: (value?: any) => void) { mocks.handlers[event] = handler; },
    emit: mocks.socketEmit,
    disconnect: mocks.disconnect,
  }),
}));

import { Terminal } from '../components/terminal/Terminal';

describe('Terminal lab metadata', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('shows the experiment target hostname in the connection banner', () => {
    render(<Terminal labSessionId="lab-1" targetHostname="configured-target" onOutput={() => {}} />);

    mocks.handlers['terminal:ready']({ restored: false });

    expect(mocks.write).toHaveBeenCalledWith(expect.stringContaining('configured-target'));
    expect(mocks.write).not.toHaveBeenCalledWith(expect.stringContaining('nmap-target'));
    expect(mocks.socketEmit).toHaveBeenCalledWith('terminal:resize', expect.objectContaining({ labSessionId: 'lab-1' }));
  });

  it('identifies the VM terminal and explains privileged Nmap scans after SSH is ready', () => {
    render(<Terminal labSessionId="lab-vm" targetHostname="nmap-target" onOutput={() => {}} />);
    mocks.handlers['terminal:ready']({ restored: false, backend: 'qemu' });
    expect(mocks.write).toHaveBeenCalledWith(expect.stringContaining('real Kali VM'));
    expect(mocks.write).toHaveBeenCalledWith(expect.stringContaining('sudo'));
  });
  it('rejoins on reconnect, gates input until ready and forwards output', () => {
    const status = vi.fn(); const output = vi.fn();
    const { unmount } = render(<Terminal labSessionId="lab-1" targetHostname="configured-target" onOutput={output} onConnectionChange={status} />);
    act(() => { mocks.handlers.connect(); mocks.input?.('before ready'); });
    expect(mocks.socketEmit).toHaveBeenCalledWith('terminal:join', { labSessionId: 'lab-1' });
    expect(mocks.socketEmit).not.toHaveBeenCalledWith('terminal:input', expect.anything());
    act(() => { mocks.handlers['terminal:ready']({ restored: true }); mocks.input?.('nmap target'); mocks.handlers['terminal:output']('real output'); });
    expect(status).toHaveBeenLastCalledWith('Connected');
    expect(mocks.socketEmit).toHaveBeenCalledWith('terminal:input', { labSessionId: 'lab-1', data: 'nmap target' });
    expect(output).toHaveBeenCalledWith('real output'); expect(mocks.write).toHaveBeenCalledWith('real output');
    act(() => { mocks.handlers.disconnect(); });
    expect(status).toHaveBeenLastCalledWith('Disconnected; waiting to reconnect');
    act(() => { mocks.handlers.connect(); });
    expect(mocks.socketEmit.mock.calls.filter(([event]) => event === 'terminal:join')).toHaveLength(2);
    fireEvent(window, new Event('resize'));
    expect(mocks.fit).toHaveBeenCalled();
    act(() => { mocks.handlers['terminal:ready']({ restored: true }); });
    mocks.socketEmit.mockClear(); fireEvent(window, new Event('resize'));
    expect(mocks.socketEmit).toHaveBeenCalledWith('terminal:resize', expect.objectContaining({ labSessionId: 'lab-1' }));
    unmount(); expect(mocks.disconnect).toHaveBeenCalled(); expect(mocks.dispose).toHaveBeenCalled(); expect(mocks.inputDispose).toHaveBeenCalled();
  });
  it('reports connection failures and terminal errors without claiming connection success', () => {
    const status = vi.fn(); render(<Terminal labSessionId="lab-1" targetHostname="target" onOutput={() => {}} onConnectionChange={status} />);
    act(() => { mocks.handlers.connect_error(); });
    expect(status).toHaveBeenLastCalledWith('Connection failed; retrying');
    act(() => { mocks.handlers['terminal:error']({ message: 'Shell unavailable' }); });
    expect(status).toHaveBeenLastCalledWith('Terminal error');
    expect(mocks.write).toHaveBeenCalledWith(expect.stringContaining('Shell unavailable'));
  });

});
