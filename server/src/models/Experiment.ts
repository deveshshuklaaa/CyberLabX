import { Schema, model, type Types } from 'mongoose';

export type LabProfile = 'shell-target-v1';
export type StudentImageKey = 'kali-nmap';
export type TargetImageKey = 'nmap-http-target';

export interface LabDefinition {
  profile: LabProfile;
  studentImageKey: StudentImageKey;
  target: { imageKey: TargetImageKey; hostname: string; displayName: string };
  terminal: { promptLabel: string };
}

export const NMAP_LAB_DEFINITION: LabDefinition = {
  profile: 'shell-target-v1',
  studentImageKey: 'kali-nmap',
  target: {
    imageKey: 'nmap-http-target',
    hostname: 'nmap-target',
    displayName: 'Controlled target',
  },
  terminal: { promptLabel: 'kali@student-lab' },
};

export interface Verification { type: 'command' | 'scan_result' | 'service_detection' | 'os_detection'; tool?: string; requiredArgs?: string[]; requiredPort?: number; requiredState?: string; requiredService?: string; }
export interface Task { id: string; title: string; description: string; hints: string[]; marks: number; order: number; verification: Verification[]; completionMessage?: string; }
export interface QuizQuestion { id: string; question: string; options: string[]; correctOption: number; explanation: string; marks: number; }
export interface IExperiment { title: string; slug: string; description: string; aim: string; objectives: string[]; theorySections: { title: string; content: string }[]; procedureSections: string[]; difficulty: string; estimatedTimeMinutes: number; status: 'draft' | 'published' | 'archived'; createdBy?: Types.ObjectId; lab: LabDefinition; tasks: Task[]; quiz: { questions: QuizQuestion[] }; }

const verificationSchema = new Schema<Verification>({ type: { type: String, enum: ['command', 'scan_result', 'service_detection', 'os_detection'], required: true }, tool: String, requiredArgs: [String], requiredPort: Number, requiredState: String, requiredService: String }, { _id: false });
const taskSchema = new Schema<Task>({ id: { type: String, required: true }, title: { type: String, required: true }, description: { type: String, required: true }, hints: [String], marks: { type: Number, required: true, min: 0 }, order: { type: Number, required: true }, verification: [verificationSchema], completionMessage: String }, { _id: false });
const questionSchema = new Schema<QuizQuestion>({ id: String, question: String, options: [String], correctOption: { type: Number, select: false }, explanation: String, marks: Number }, { _id: false });
const labSchema = new Schema<LabDefinition>({
  profile: { type: String, enum: ['shell-target-v1'], required: true },
  studentImageKey: { type: String, enum: ['kali-nmap'], required: true },
  target: {
    imageKey: { type: String, enum: ['nmap-http-target'], required: true },
    hostname: { type: String, required: true, trim: true, maxlength: 63, match: /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/ },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
  },
  terminal: { promptLabel: { type: String, required: true, trim: true, maxlength: 120 } },
}, { _id: false });

const schema = new Schema<IExperiment>({ title: { type: String, required: true }, slug: { type: String, unique: true, required: true }, description: { type: String, required: true }, aim: { type: String, required: true }, objectives: [String], theorySections: [{ title: String, content: String }], procedureSections: [String], difficulty: String, estimatedTimeMinutes: Number, status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' }, createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, lab: { type: labSchema, required: true }, tasks: [taskSchema], quiz: { questions: [questionSchema] } }, { timestamps: true });
export const Experiment = model<IExperiment>('Experiment', schema);
