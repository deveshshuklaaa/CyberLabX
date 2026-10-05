import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ endpoint: '', instance: null as EventTarget | null, disconnect: vi.fn() }));
vi.mock('@novnc/novnc', () => ({ default: class extends EventTarget {
  scaleViewport = false;
  constructor(_element: HTMLElement, url: string) { super(); mocks.endpoint = url; mocks.instance = this; }
  disconnect = mocks.disconnect;
} }));
import { KaliDesktop } from '../components/terminal/KaliDesktop';

it('connects through the session route, shows connection state and releases noVNC on close', () => {
  const view = render(<KaliDesktop labSessionId="64b000000000000000000001" />);
  expect(mocks.endpoint).toBe('ws://localhost:5000/desktop/64b000000000000000000001');
  expect(mocks.endpoint).not.toContain('5900');
  act(() => { mocks.instance!.dispatchEvent(new Event('connect')); });
  expect(screen.getByRole('status')).toHaveTextContent('Kali desktop connected');
  act(() => { mocks.instance!.dispatchEvent(new Event('disconnect')); });
  expect(screen.getByRole('status')).toHaveTextContent('Desktop disconnected');
  view.unmount(); expect(mocks.disconnect).toHaveBeenCalledOnce();
});
