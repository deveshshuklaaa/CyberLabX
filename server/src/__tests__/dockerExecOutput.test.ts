import { describe, expect, it } from 'vitest';
import { createDockerExecOutputDemuxer } from '../services/labEngine.js';

function dockerFrame(payload: string) {
  const body = Buffer.from(payload, 'utf8');
  const header = Buffer.alloc(8);
  header[0] = 1;
  header.writeUInt32BE(body.length, 4);
  return Buffer.concat([header, body]);
}

async function readDemuxed(chunks: Buffer[]) {
  const demuxer = createDockerExecOutputDemuxer();
  const output: Buffer[] = [];
  demuxer.on('data', chunk => output.push(Buffer.from(chunk)));
  const completed = new Promise<void>((resolve, reject) => {
    demuxer.on('end', resolve);
    demuxer.on('error', reject);
  });
  for (const chunk of chunks) demuxer.write(chunk);
  demuxer.end();
  await completed;
  return Buffer.concat(output).toString('utf8');
}

describe('Docker exec output demuxing', () => {
  it('removes Docker framing split across chunks without changing payload bytes', async () => {
    const framed = Buffer.concat([dockerFrame('\u001b[32mabcdef\u001b[0m'), dockerFrame('\r\n')]);
    const output = await readDemuxed([framed.subarray(0, 5), framed.subarray(5, 15), framed.subarray(15)]);

    expect(output).toBe('\u001b[32mabcdef\u001b[0m\r\n');
  });

  it('passes raw PTY output through unchanged', async () => {
    expect(await readDemuxed([Buffer.from('nmap -sS nmap-target\r\n', 'utf8')])).toBe('nmap -sS nmap-target\r\n');
  });
});
