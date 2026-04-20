'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import type { MfaDisableRequest, RegenerateBackupCodesRequest } from '@metaflow/shared-types';

import { BackupCodesDisplay } from '@/components/auth/backup-codes-display';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth/use-auth';
import { useAuthStore } from '@/stores/use-auth-store';

export function MfaSection(): React.ReactElement {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const [regenOpen, setRegenOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [revealedCodes, setRevealedCodes] = useState<string[] | null>(null);

  const [regenPassword, setRegenPassword] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [disableTotp, setDisableTotp] = useState('');

  const regen = useMutation({
    mutationFn: (body: RegenerateBackupCodesRequest) => authApi.regenerateBackupCodes(body),
    onSuccess: ({ backupCodes }) => {
      setRevealedCodes(backupCodes);
      setRegenOpen(false);
      setRegenPassword('');
    },
  });

  const disable = useMutation({
    mutationFn: (body: MfaDisableRequest) => authApi.disableMfa(body),
    onSuccess: async () => {
      toast.success('MFA devre dışı bırakıldı');
      const me = await authApi.me();
      useAuthStore.getState().setMe(me);
      void qc.invalidateQueries();
      setDisableOpen(false);
      setDisablePassword('');
      setDisableTotp('');
    },
  });

  const enabled = user?.mfaEnabled ?? false;
  const regenError = regen.error instanceof ApiError ? regen.error : null;
  const disableError = disable.error instanceof ApiError ? disable.error : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>İki adımlı doğrulama</CardTitle>
        <CardDescription>
          {enabled
            ? 'MFA aktif. Yedek kodlarını yeniden oluşturabilir veya devre dışı bırakabilirsin.'
            : 'MFA henüz aktif değil. Login akışında tekrar giriş yapıldığında kurulum başlar.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          {enabled ? (
            <>
              <ShieldCheck className="h-4 w-4 text-[hsl(var(--success))]" />
              <span>Aktif</span>
            </>
          ) : (
            <>
              <ShieldOff className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <span>Pasif</span>
            </>
          )}
        </div>

        {enabled ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRegenOpen(true);
              }}
            >
              Yedek kodları yenile
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDisableOpen(true);
              }}
            >
              MFA’yı kapat
            </Button>
          </div>
        ) : null}
      </CardContent>

      <Dialog
        open={regenOpen}
        onOpenChange={(o) => {
          setRegenOpen(o);
          if (!o) regen.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yedek kodları yenile</DialogTitle>
            <DialogDescription>
              Mevcut yedek kodlar geçersiz olur. Devam etmek için şifreni doğrula.
            </DialogDescription>
          </DialogHeader>
          {regenError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {regenError.body.code === 'wrong_password'
                  ? 'Şifre hatalı.'
                  : regenError.body.message}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="regen-pw">Şifre</Label>
            <Input
              id="regen-pw"
              type="password"
              autoComplete="current-password"
              value={regenPassword}
              onChange={(e) => {
                setRegenPassword(e.target.value);
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRegenOpen(false);
              }}
            >
              İptal
            </Button>
            <Button
              disabled={regen.isPending || regenPassword.length === 0}
              onClick={() => {
                regen.mutate({ password: regenPassword });
              }}
            >
              {regen.isPending ? 'Oluşturuluyor…' : 'Yenile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealedCodes !== null}
        onOpenChange={(o) => {
          if (!o) setRevealedCodes(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni yedek kodlar</DialogTitle>
            <DialogDescription>
              Bunları güvenli bir yere kaydet — bir daha gösterilmeyecek.
            </DialogDescription>
          </DialogHeader>
          {revealedCodes ? (
            <BackupCodesDisplay
              codes={revealedCodes}
              onAcknowledge={() => {
                setRevealedCodes(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={disableOpen}
        onOpenChange={(o) => {
          setDisableOpen(o);
          if (!o) disable.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>MFA’yı devre dışı bırak</DialogTitle>
            <DialogDescription>
              Hesabın daha az korunaklı olur. Doğrulamak için şifren ve mevcut TOTP kodu gerekli.
            </DialogDescription>
          </DialogHeader>
          {disableError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {disableError.body.code === 'wrong_password'
                  ? 'Şifre hatalı.'
                  : disableError.body.code === 'invalid_totp_code'
                    ? 'TOTP kodu hatalı.'
                    : disableError.body.code === 'mfa_disable_not_allowed'
                      ? 'MFA devre dışı bırakma sunucu tarafından engellenmiş.'
                      : disableError.body.message}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="disable-pw">Şifre</Label>
              <Input
                id="disable-pw"
                type="password"
                autoComplete="current-password"
                value={disablePassword}
                onChange={(e) => {
                  setDisablePassword(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disable-totp">6 haneli kod</Label>
              <Input
                id="disable-totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={disableTotp}
                onChange={(e) => {
                  setDisableTotp(e.target.value);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDisableOpen(false);
              }}
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              disabled={
                disable.isPending || disablePassword.length === 0 || disableTotp.length !== 6
              }
              onClick={() => {
                disable.mutate({ password: disablePassword, totpCode: disableTotp });
              }}
            >
              {disable.isPending ? 'Kapatılıyor…' : 'Kapat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
