import { Schema, model, type Types } from 'mongoose';
export interface IReport { attemptId: Types.ObjectId; studentId: Types.ObjectId; experimentId: Types.ObjectId; score: number; totalMarks: number; quizScore: number; generatedAt: Date; filePath: string; }
const schema = new Schema<IReport>({ attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true, unique: true }, studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, experimentId: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true }, score: Number, totalMarks: Number, quizScore: Number, generatedAt: { type: Date, default: Date.now }, filePath: String }); export const Report = model<IReport>('Report', schema);

