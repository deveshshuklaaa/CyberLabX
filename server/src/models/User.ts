import { Schema, model, type HydratedDocument } from 'mongoose';
export type Role = 'student' | 'faculty' | 'admin';
export interface IUser { firstName: string; lastName: string; email: string; passwordHash?: string; googleId?: string; avatarUrl?: string; role: Role; isActive: boolean; createdAt: Date; updatedAt: Date; }
const schema = new Schema<IUser>({
  firstName: { type: String, required: true, trim: true, maxlength: 60 },
  lastName: { type: String, default: '', trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required(this: IUser) { return !this.googleId; }, select: false },
  googleId: { type: String, unique: true, sparse: true, maxlength: 255 },
  avatarUrl: { type: String, maxlength: 2048 },
  // The existing faculty value is the teacher role; preserve stored accounts and permissions.
  role: { type: String, enum: ['student', 'faculty', 'admin'], default: 'student', index: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
export const User = model<IUser>('User', schema);
export type UserDocument = HydratedDocument<IUser>;

