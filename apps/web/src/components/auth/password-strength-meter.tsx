'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface Props {
  password: string;
  className?: string;
}

interface Score {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  hints: string[];
}

/**
 * Lightweight client-side strength meter — purely advisory. The server is
 * authoritative (zxcvbn-ts ≥ 3 + dictionary checks). We deliberately avoid
 * shipping zxcvbn-ts to the client to keep the auth bundle tiny.
 */
function score(password: string): Score {
  const hints: string[] = [];
  let n = 0;
  if (password.length >= 12) n += 1;
  else hints.push('En az 12 karakter');
  if (/[A-Z]/.test(password)) n += 1;
  else hints.push('Bir büyük harf');
  if (/[a-z]/.test(password)) n += 1;
  else hints.push('Bir küçük harf');
  if (/[0-9]/.test(password)) n += 1;
  else hints.push('Bir rakam');
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 16) n += 1;

  const level = Math.min(n, 4) as Score['level'];
  const labels = ['Çok zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü'];
  return { level, label: labels[level] ?? 'Çok zayıf', hints };
}

export function PasswordStrengthMeter({ password, className }: Props): React.ReactElement | null {
  if (password.length === 0) return null;
  const s = score(password);
  const colors = [
    'bg-[hsl(var(--destructive))]',
    'bg-[hsl(var(--destructive))]',
    'bg-[hsl(var(--warning))]',
    'bg-[hsl(var(--warning))]',
    'bg-[hsl(var(--success))]',
  ];
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex h-1.5 gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-full transition-colors',
              i < s.level ? colors[s.level] : 'bg-[hsl(var(--muted))]',
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
        <span>Şifre gücü: {s.label}</span>
        {s.hints.length > 0 ? <span>{s.hints[0]}</span> : null}
      </div>
    </div>
  );
}
