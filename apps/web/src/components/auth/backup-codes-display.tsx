'use client';

import { Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface Props {
  codes: string[];
  onAcknowledge?: () => void;
}

/**
 * One-time backup-code reveal. The server returns plaintext codes only on
 * MFA setup or regeneration; we never re-fetch them. The user must copy
 * or download before navigating away.
 */
export function BackupCodesDisplay({ codes, onAcknowledge }: Props): React.ReactElement {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(codes.join('\n'));
    toast.success('Yedek kodlar panoya kopyalandı');
  };

  const handleDownload = (): void => {
    const blob = new Blob(
      [
        'metaflow yedek kodları\n',
        '-----------------------\n',
        'Bu kodları güvenli bir yerde saklayın. Her kod yalnızca bir kez kullanılabilir.\n\n',
        codes.join('\n'),
        '\n',
      ],
      { type: 'text/plain;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metaflow-yedek-kodlar.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Alert variant="warning">
        <AlertTitle>Bu kodları şimdi kaydedin</AlertTitle>
        <AlertDescription>
          Yedek kodlar yalnızca bir kez gösterilir. Telefonunuza erişiminizi kaybederseniz
          hesabınıza giriş için tek yol bu kodlardır.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-2 rounded-md border bg-[hsl(var(--muted))] p-4 font-mono text-sm">
        {codes.map((code) => (
          <div key={code} className="select-all py-1 text-center">
            {code}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void handleCopy();
          }}
          className="flex-1"
        >
          <Copy className="mr-2 h-4 w-4" /> Kopyala
        </Button>
        <Button type="button" variant="outline" onClick={handleDownload} className="flex-1">
          <Download className="mr-2 h-4 w-4" /> .txt indir
        </Button>
      </div>

      {onAcknowledge ? (
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => {
                setAcknowledged(e.target.checked);
              }}
              className="mt-0.5"
            />
            <span>Yedek kodları güvenli bir yere kaydettiğimi onaylıyorum.</span>
          </label>
          <Button type="button" disabled={!acknowledged} onClick={onAcknowledge} className="w-full">
            Devam et
          </Button>
        </div>
      ) : null}
    </div>
  );
}
