import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const schema = z.object({
  QEMU_BINARY: z.string().default('qemu-system-x86_64'),
  QEMU_IMG_BINARY: z.string().default('qemu-img'),
  VM_BASE_IMAGE: z.string().default(path.join(projectRoot, 'infrastructure/vm/kali/base/kali.qcow2')),
  VM_RUNTIME_DIR: z.string().default(path.join(projectRoot, 'infrastructure/vm/runtime')),
  VM_CPUS: z.coerce.number().int().min(2).max(4).default(2),
  VM_MEMORY_MB: z.coerce.number().int().min(4096).max(8192).default(4096),
  VM_HOST_RESERVE_MB: z.coerce.number().int().min(1024).default(2048),
  VM_MAX_CONCURRENT: z.coerce.number().int().min(1).max(8).default(1),
  VM_MIN_FREE_DISK_GB: z.coerce.number().int().min(8).default(16),
  VM_NETWORK_MODE: z.enum(['nat', 'bridged']).default('nat'),
  VM_TAP_ADAPTER: z.string().regex(/^[a-zA-Z0-9 _-]+$/).optional(),
  VM_ALLOW_INTERNET: z.enum(['true', 'false']).default('false'),
  VM_BOOT_TIMEOUT_MS: z.coerce.number().int().min(30000).max(600000).default(180000),
});
export const vmConfig = () => schema.parse(process.env);
export type VmConfig = z.infer<typeof schema>;
export type VmState = 'creating' | 'starting' | 'running' | 'stopping' | 'failed';
export interface VmRecord {
  id: string; name: string; attemptId: string; studentId: string; profile: string;
  pid?: number; qmpPort: number; sshPort: number; vncPort: number;
  overlay: string; secondaryDisk?: string; directory: string;
  createdAt: string; expiresAt: string; state: VmState;
  networkMode: 'nat' | 'bridged'; hostKeyHash: string;
}

export function assertId(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new Error('Invalid attempt identity.');
}

export function qemuArgs(vm: VmRecord, config: VmConfig): string[] {
  // QEMU option values have a comma sub-option grammar, even without a shell.
  const disk = (p: string) => p.replace(/,/g, ',,');
  const args = ['-name', vm.name, '-uuid', vm.id, '-machine', 'q35', '-accel', 'whpx',
    '-smp', String(config.VM_CPUS), '-m', String(config.VM_MEMORY_MB),
    '-display', 'none', '-vga', 'std', '-nic', 'none', '-monitor', 'none', '-serial', 'none',
    '-qmp', `tcp:127.0.0.1:${vm.qmpPort},server=on,wait=off`,
    '-vnc', `127.0.0.1:${vm.vncPort - 5900}`,
    '-drive', `file=${disk(vm.overlay)},format=qcow2,if=virtio`,
    '-fw_cfg', `name=opt/org.somaiya/config,file=${disk(path.join(vm.directory, 'guest.json'))}`,
    '-netdev', `user,id=management,restrict=${config.VM_ALLOW_INTERNET === 'true' ? 'off' : 'on'},hostfwd=tcp:127.0.0.1:${vm.sshPort}-:22`,
    '-device', 'virtio-net-pci,netdev=management', '-device', 'qemu-xhci', '-device', 'usb-tablet'];
  if (vm.secondaryDisk) args.push('-drive', `file=${disk(vm.secondaryDisk)},format=qcow2,if=virtio`);
  if (config.VM_NETWORK_MODE === 'bridged') {
    if (!config.VM_TAP_ADAPTER) throw new Error('Bridged mode requires a preconfigured TAP adapter.');
    args.push('-netdev', `tap,id=labnet,ifname=${config.VM_TAP_ADAPTER},script=no,downscript=no`, '-device', 'virtio-net-pci,netdev=labnet');
  }
  return args;
}
