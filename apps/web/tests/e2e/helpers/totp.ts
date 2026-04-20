import { authenticator } from 'otplib';

export function totp(secret: string): string {
  return authenticator.generate(secret);
}
