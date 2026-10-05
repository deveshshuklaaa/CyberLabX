import { Schema, model, type Types } from 'mongoose';

export type LabProfile =
  | 'shell-target-v1'
  | 'recon-v1'
  | 'dos-analysis-v1'
  | 'keylogger-lab-v1'
  | 'email-forensics-v1'
  | 'file-forensics-v1'
  | 'disk-forensics-v1';

export type StudentImageKey =
  | 'kali-nmap'
  | 'kali-recon'
  | 'kali-dos-attacker'
  | 'kali-keylogger-lab'
  | 'kali-email-forensics'
  | 'kali-file-forensics'
  | 'kali-disk-forensics';

export type TargetImageKey =
  | 'nmap-http-target'
  | 'dos-http-victim'
  | 'dos-legitimate-client'
  | 'recon-target';

export interface NmapLabDefinition {
  profile: 'shell-target-v1';
  studentImageKey: 'kali-nmap';
  target: { imageKey: 'nmap-http-target'; hostname: string; displayName: string };
  terminal: { promptLabel: string };
}

export interface ReconLabDefinition {
  profile: 'recon-v1';
  studentImageKey: 'kali-recon';
  target: { imageKey: 'recon-target'; hostname: string; displayName: string };
  terminal: { promptLabel: string };
}

export interface DosLabDefinition {
  profile: 'dos-analysis-v1';
  resources: [
    { role: 'student'; imageKey: 'kali-dos-attacker'; hostname: 'attacker'; displayName: string },
    { role: 'victim'; imageKey: 'dos-http-victim'; hostname: 'victim'; displayName: string },
    { role: 'legitimate-client'; imageKey: 'dos-legitimate-client'; hostname: 'legitimate-client'; displayName: string }
  ];
  terminal: { promptLabel: string };
}

export interface KeyloggerLabDefinition {
  profile: 'keylogger-lab-v1';
  studentImageKey: 'kali-keylogger-lab';
  terminal: { promptLabel: string };
}

export interface EmailForensicsLabDefinition {
  profile: 'email-forensics-v1';
  studentImageKey: 'kali-email-forensics';
  terminal: { promptLabel: string };
}

export interface FileForensicsLabDefinition {
  profile: 'file-forensics-v1';
  studentImageKey: 'kali-file-forensics';
  terminal: { promptLabel: string };
}

export interface DiskForensicsLabDefinition {
  profile: 'disk-forensics-v1';
  studentImageKey: 'kali-disk-forensics';
  terminal: { promptLabel: string };
}

export type LabDefinition =
  | NmapLabDefinition
  | ReconLabDefinition
  | DosLabDefinition
  | KeyloggerLabDefinition
  | EmailForensicsLabDefinition
  | FileForensicsLabDefinition
  | DiskForensicsLabDefinition;

export const NMAP_LAB_DEFINITION: NmapLabDefinition = {
  profile: 'shell-target-v1',
  studentImageKey: 'kali-nmap',
  target: { imageKey: 'nmap-http-target', hostname: 'nmap-target', displayName: 'Controlled target' },
  terminal: { promptLabel: 'kali@student-lab' },
};

export const RECON_LAB_DEFINITION: ReconLabDefinition = {
  profile: 'recon-v1',
  studentImageKey: 'kali-recon',
  target: { imageKey: 'recon-target', hostname: 'recon-target', displayName: 'Controlled Recon Target' },
  terminal: { promptLabel: 'student@recon-lab' },
};

export const DOS_LAB_DEFINITION: DosLabDefinition = {
  profile: 'dos-analysis-v1',
  resources: [
    { role: 'student', imageKey: 'kali-dos-attacker', hostname: 'attacker', displayName: 'Attacker workstation' },
    { role: 'victim', imageKey: 'dos-http-victim', hostname: 'victim', displayName: 'Controlled HTTP victim' },
    { role: 'legitimate-client', imageKey: 'dos-legitimate-client', hostname: 'legitimate-client', displayName: 'Normal traffic generator' },
  ],
  terminal: { promptLabel: 'student@attacker' },
};

export const KEYLOGGER_LAB_DEFINITION: KeyloggerLabDefinition = {
  profile: 'keylogger-lab-v1',
  studentImageKey: 'kali-keylogger-lab',
  terminal: { promptLabel: 'student@keylogger-lab' },
};

export const EMAIL_FORENSICS_LAB_DEFINITION: EmailForensicsLabDefinition = {
  profile: 'email-forensics-v1',
  studentImageKey: 'kali-email-forensics',
  terminal: { promptLabel: 'student@forensics-lab' },
};

export const FILE_FORENSICS_LAB_DEFINITION: FileForensicsLabDefinition = {
  profile: 'file-forensics-v1',
  studentImageKey: 'kali-file-forensics',
  terminal: { promptLabel: 'student@file-lab' },
};

export const DISK_FORENSICS_LAB_DEFINITION: DiskForensicsLabDefinition = {
  profile: 'disk-forensics-v1',
  studentImageKey: 'kali-disk-forensics',
  terminal: { promptLabel: 'student@disk-forensics' },
};

export interface Verification {
  type:
    | 'command'
    | 'scan_result'
    | 'service_detection'
    | 'os_detection'
    | 'output_contains'
    | 'bounded_network_activity'
    | 'packet_analysis';
  tool?: string;
  requiredArgs?: string[];
  requiredPort?: number;
  requiredState?: string;
  requiredService?: string;
  requiredTarget?: string;
  requiredOutput?: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  hints: string[];
  marks: number;
  order: number;
  verification: Verification[];
  completionMessage?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOption: number;
  explanation: string;
  marks: number;
}

export interface IExperiment {
  title: string;
  slug: string;
  description: string;
  aim: string;
  objectives: string[];
  theorySections: { title: string; content: string }[];
  procedureSections: string[];
  category?: string;
  difficulty: string;
  estimatedTimeMinutes: number;
  status: 'draft' | 'published' | 'archived';
  createdBy?: Types.ObjectId;
  lab: LabDefinition;
  tasks: Task[];
  quiz: { questions: QuizQuestion[] };
}

const hostname = {
  type: String,
  required: true,
  trim: true,
  maxlength: 63,
  match: /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
} as const;

const verificationSchema = new Schema<Verification>({
  type: {
    type: String,
    enum: ['command', 'scan_result', 'service_detection', 'os_detection', 'output_contains', 'bounded_network_activity', 'packet_analysis'],
    required: true,
  },
  tool: String,
  requiredArgs: [String],
  requiredPort: Number,
  requiredState: String,
  requiredService: String,
  requiredTarget: String,
  requiredOutput: [String],
}, { _id: false });

const taskSchema = new Schema<Task>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  hints: [String],
  marks: { type: Number, required: true, min: 0 },
  order: { type: Number, required: true },
  verification: [verificationSchema],
  completionMessage: String,
}, { _id: false });

const questionSchema = new Schema<QuizQuestion>({
  id: String,
  question: String,
  options: [String],
  correctOption: { type: Number, select: false },
  explanation: String,
  marks: Number,
}, { _id: false });

const resourceSchema = new Schema({
  role: { type: String, enum: ['student', 'victim', 'legitimate-client'], required: true },
  imageKey: { type: String, enum: ['kali-dos-attacker', 'dos-http-victim', 'dos-legitimate-client'], required: true },
  hostname,
  displayName: { type: String, required: true, trim: true, maxlength: 120 },
}, { _id: false });

const labSchema = new Schema({
  profile: {
    type: String,
    enum: [
      'shell-target-v1',
      'recon-v1',
      'dos-analysis-v1',
      'keylogger-lab-v1',
      'email-forensics-v1',
      'file-forensics-v1',
      'disk-forensics-v1',
    ],
    required: true,
  },
  studentImageKey: {
    type: String,
    enum: [
      'kali-nmap',
      'kali-recon',
      'kali-dos-attacker',
      'kali-keylogger-lab',
      'kali-email-forensics',
      'kali-file-forensics',
      'kali-disk-forensics',
    ],
  },
  target: {
    imageKey: { type: String, enum: ['nmap-http-target', 'recon-target'] },
    hostname: { ...hostname, required: false },
    displayName: { type: String, trim: true, maxlength: 120 },
  },
  resources: [resourceSchema],
  terminal: {
    promptLabel: { type: String, required: true, trim: true, maxlength: 120 },
  },
}, { _id: false });

labSchema.path('resources').validate(function (resources: unknown[]) {
  if ((this as { profile?: string }).profile !== 'dos-analysis-v1') return !resources?.length;
  const expected = ['student:kali-dos-attacker:attacker', 'victim:dos-http-victim:victim', 'legitimate-client:dos-legitimate-client:legitimate-client'];
  return Array.isArray(resources) && resources.length === 3 && resources.map(r => `${(r as any).role}:${(r as any).imageKey}:${(r as any).hostname}`).every((item, index) => item === expected[index]);
}, 'The DoS lab must use exactly the approved attacker, victim, and legitimate-client resources.');

labSchema.pre('validate', function () {
  const lab = this as unknown as {
    profile: string;
    studentImageKey?: string;
    target?: { imageKey?: string; hostname?: string; displayName?: string };
    resources?: unknown[];
  };

  if ((lab.profile === 'shell-target-v1' || lab.profile === 'recon-v1') && (!lab.studentImageKey || !lab.target?.imageKey || !lab.target.hostname || !lab.target.displayName)) {
    this.invalidate('target', 'Network target labs require approved student and target configuration.');
  }

  if (lab.profile === 'dos-analysis-v1' && (lab.studentImageKey || lab.target?.imageKey)) {
    this.invalidate('resources', 'DoS labs use resources only.');
  }

  if (['keylogger-lab-v1', 'email-forensics-v1', 'file-forensics-v1', 'disk-forensics-v1'].includes(lab.profile) && !lab.studentImageKey) {
    this.invalidate('studentImageKey', 'Standalone labs require an approved student image key.');
  }
});

const schema = new Schema<IExperiment>({
  title: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  description: { type: String, required: true },
  aim: { type: String, required: true },
  objectives: [String],
  theorySections: [{ title: String, content: String }],
  procedureSections: [String],
  category: { type: String, default: 'Network Security' },
  difficulty: String,
  estimatedTimeMinutes: Number,
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  lab: { type: labSchema, required: true },
  tasks: [taskSchema],
  quiz: { questions: [questionSchema] },
}, { timestamps: true });

export const Experiment = model<IExperiment>('Experiment', schema);
