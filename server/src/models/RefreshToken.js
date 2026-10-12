import mongoose from 'mongoose';

/**
 * Server-side record of an issued refresh token. Only the SHA-256 hash is stored, so a
 * database leak does not hand out usable sessions. A token is single-use (rotated on refresh).
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB deletes expired docs

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
