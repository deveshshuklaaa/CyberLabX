import { Schema, model, type HydratedDocument } from 'mongoose';
export type Role = 'student' | 'faculty' | 'admin';
export interface IUser { firstName: string; lastName: string; email: string; passwordHash: string; role: Role; isActive: boolean; createdAt: Date; updatedAt: Date; }
const schema = new Schema<IUser>({ firstName: { type: String, required: true, trim: true, maxlength: 60 }, lastName: { type: String, required: true, trim: true, maxlength: 60 }, email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 }, passwordHash: { type: String, required: true, select: false }, role: { type: String, enum: ['student', 'faculty', 'admin'], default: 'student', index: true }, isActive: { type: Boolean, default: true } }, { timestamps: true });
export const User = model<IUser>('User', schema);
export type UserDocument = HydratedDocument<IUser>;

