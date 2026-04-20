import { authenticator } from 'otplib';

/**
 * Generates the current TOTP for a base32 secret using the same parameters
 * the API enforces (default otplib step=30, window=1).
 */
export function totp(secret: string): string {
  return authenticator.generate(secret);
}
