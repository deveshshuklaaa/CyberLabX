import type { Verification, Task } from '../models/Experiment.js';

/* ------------------------------------------------------------------ */
/*  Rule result type returned per verification rule                   */
/* ------------------------------------------------------------------ */
export interface RuleResult {
  type: string;
  passed: boolean;
  message: string;
}

export interface TaskValidationResult {
  passed: boolean;
  score: number;
  feedback: string;
  ruleResults: RuleResult[];
}

/* ------------------------------------------------------------------ */
/*  Extensible rule-handler registry                                  */
/*  Each handler receives the rule definition, the raw command string  */
/*  and the captured stdout/output, returning a single RuleResult.    */
/* ------------------------------------------------------------------ */
type RuleHandler = (
  rule: Verification,
  command: string,
  output: string,
) => RuleResult;

const ruleHandlers: Record<string, RuleHandler> = {
  /* ---------- command: verify the CLI invocation itself ---------- */
  command(rule, command) {
    const tokens = command.trim().toLowerCase().split(/\s+/);
    const tool = (rule.tool ?? 'nmap').toLowerCase();

    if (!tokens[0]?.startsWith(tool)) {
      return { type: 'command', passed: false, message: `Expected command to start with "${tool}".` };
    }

    const missing = (rule.requiredArgs ?? []).filter(arg => {
      const required = arg.toLowerCase();
      // Nmap's aggressive mode includes OS and service/version detection.
      const aggressiveEquivalent = (required === '-o' || required === '-sv') && tokens.includes('-a');
      return !tokens.includes(required) && !aggressiveEquivalent;
    });
    if (missing.length > 0) {
      return { type: 'command', passed: false, message: `Missing required flag(s): ${missing.join(', ')}.` };
    }

    /* Definitions may constrain a hostname, but never permit arbitrary targets. */
    const targetCheckRequired = rule.requiredTarget !== undefined ? rule.requiredTarget !== 'none' : tool === 'nmap';
    if (targetCheckRequired) {
      const requiredTarget = (rule.requiredTarget ?? 'nmap-target').toLowerCase();
      if (!tokens.some(token => token === requiredTarget || token === `http://${requiredTarget}` || token === `https://${requiredTarget}` || token.startsWith(`http://${requiredTarget}/`) || token.startsWith(`https://${requiredTarget}/`)) && !tokens.some(t => requiredTarget === 'nmap-target' && /^(\d{1,3}\.){3}\d{1,3}$/.test(t))) {
        return { type: 'command', passed: false, message: `Command must target the lab host (${requiredTarget}).` };
      }
    }

    return { type: 'command', passed: true, message: 'Command syntax verified.' };
  },

  output_contains(rule, _command, output) {
    const required = rule.requiredOutput ?? [];
    const missing = required.filter(value => !output.toLowerCase().includes(value.toLowerCase()));
    return { type: 'output_contains', passed: missing.length === 0, message: missing.length ? `Expected terminal output: ${missing.join(', ')}.` : 'Server-captured command output verified.' };
  },

  bounded_network_activity(rule, command, output) {
    const tokens = command.trim().split(/\s+/);
    const expectedTool = rule.tool ?? 'dos-sim';
    const validInvocation = tokens.length === 1 && (tokens[0] === expectedTool || tokens[0] === `/usr/local/bin/${expectedTool}`);
    const evidence = output.includes('CONTROLLED_SYN_COMPLETE') && output.includes('count=60') && output.includes('rate=10pps') && output.includes('target=victim');
    return { type: 'bounded_network_activity', passed: validInvocation && evidence, message: validInvocation && evidence ? 'Verified 60 SYN probes at the server-approved 10 packets/second rate to victim only.' : 'Run the approved dos-sim command and wait for its bounded completion record.' };
  },

  packet_analysis(rule, command, output) {
    const tool = (rule.tool ?? 'tshark').toLowerCase();
    const startsWithTool = command.trim().toLowerCase().split(/\s+/)[0] === tool;
    const required = rule.requiredOutput ?? ['victim', 'syn'];
    const missing = required.filter(value => !output.toLowerCase().includes(value.toLowerCase()));
    return { type: 'packet_analysis', passed: startsWithTool && missing.length === 0, message: startsWithTool && missing.length === 0 ? 'Captured traffic analysis identifies the approved SYN pattern.' : `Use ${tool} and identify: ${missing.join(', ') || 'the required traffic pattern'}.` };
  },

  /* ---------- scan_result: verify port/state in output ---------- */
  scan_result(rule, _command, output) {
    // Normalize whitespace so "80/tcp   open" matches "80/tcp open"
    const lower = output.toLowerCase().replace(/\s+/g, ' ');
    const port = String(rule.requiredPort ?? '');
    const state = (rule.requiredState ?? 'open').toLowerCase();

    const found =
      lower.includes(`${port}/${state}`) ||
      lower.includes(`${port}/tcp ${state}`) ||
      lower.includes(`${port}/udp ${state}`);

    return {
      type: 'scan_result',
      passed: found,
      message: found
        ? `Port ${port} is ${state} as expected.`
        : `Expected port ${port} in state "${state}" was not found in scan output.`,
    };
  },

  /* ---------- service_detection: verify service string ---------- */
  service_detection(rule, _command, output) {
    const tokens = _command.trim().toLowerCase().split(/\s+/);
    if (!tokens.includes('-sv') && !tokens.includes('-a')) {
      return { type: 'service_detection', passed: false, message: 'Service/version detection flag (-sV or -A) was not used.' };
    }
    const service = (rule.requiredService ?? '').toLowerCase();
    const found = output.toLowerCase().includes(service);

    return {
      type: 'service_detection',
      passed: found,
      message: found
        ? `Service "${rule.requiredService}" detected.`
        : `Expected service "${rule.requiredService}" was not found in the output.`,
    };
  },

  /* ---------- os_detection: verify OS fingerprint output -------- */
  os_detection(rule, command, output) {
    const tokens = command.trim().toLowerCase().split(/\s+/);
    // Accept -O (explicit OS detection) or -A (aggressive scan, which includes OS detection)
    const hasOsFlag = tokens.includes('-o') || tokens.includes('-a') ||
      tokens.some(t => /^-[a-z]*[oa]/i.test(t) && t.startsWith('-'));
    if (!hasOsFlag) {
      return { type: 'os_detection', passed: false, message: 'OS detection flag (-O or -A) was not used.' };
    }

    const lower = output.toLowerCase();
    const patterns = ['os details:', 'running:', 'os cpe:', 'aggressive os guesses:',
      'os detection performed', 'os:', 'linux', 'windows', 'freebsd'];
    const found = patterns.some(p => lower.includes(p));

    return {
      type: 'os_detection',
      passed: found,
      message: found
        ? 'OS detection result verified.'
        : 'No OS detection result found in Nmap output. Ensure -O was used against the target.',
    };
  },
};

/* ------------------------------------------------------------------ */
/*  Public API — validateTask                                         */
/* ------------------------------------------------------------------ */
export function validateTask(
  task: Task,
  command: string,
  output = '',
): TaskValidationResult {
  if (!task.verification || task.verification.length === 0) {
    return {
      passed: false,
      score: 0,
      feedback: 'This task has no verification rules configured.',
      ruleResults: [],
    };
  }

  const ruleResults: RuleResult[] = task.verification.map(rule => {
    const handler = ruleHandlers[rule.type];
    if (!handler) {
      return { type: rule.type, passed: false, message: `Unknown verification rule type: "${rule.type}".` };
    }
    return handler(rule, command, output);
  });

  const passed = ruleResults.length > 0 && ruleResults.every(r => r.passed);

  return {
    passed,
    score: passed ? task.marks : 0,
    feedback: passed
      ? task.completionMessage ?? 'Task verified. Great work.'
      : 'One or more verification checks did not pass. Review the feedback and try again.',
    ruleResults,
  };
}

/* Allow external code to register additional rule types at runtime. */
export function registerRuleHandler(type: string, handler: RuleHandler): void {
  ruleHandlers[type] = handler;
}
