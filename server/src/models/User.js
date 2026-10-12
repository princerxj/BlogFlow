import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, trim: true, maxlength: 80, default: '' },
    // select:false -> never loaded (or serialized) unless a query explicitly asks for it.
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);

export const publicUser = (u) => ({ id: String(u._id), email: u.email, name: u.name, createdAt: u.createdAt });
