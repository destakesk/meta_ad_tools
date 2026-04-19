# Module 02 — Auth & User Management

**Module goal:** Custom-built authentication ve authorization sistemi kurmak. Vendor'sız (NextAuth yok, Clerk yok), tam kontrol bizde. Organization + Workspace data modelini eklemek, role-based permission sistemini oturtmak, MFA zorunluluğu getirmek.

---

## 1. Hedef

Module 01'de çalışan altyapı üzerine aşağıdakileri inşa etmek:

- Password-based registration + login
- Email verification flow (magic link)
- Password reset flow (token-based)
- TOTP-based MFA (zorunlu, her kullanıcı için)
- JWT access token + rotating refresh token sistemi
- Workspace-scoped permission sistemi (URL-path tabanlı)
- Session management (aktif cihazları görme + revoke)
- Role-based access control (4 role + granular permissions)
- Ekip üye davet sistemi (email invitation)

### Başarı kriterleri
1. Yeni kullanıcı signup → email verification → MFA enrollment → login akışı baştan sona çalışıyor
2. Password unutma → reset link → yeni password akışı çalışıyor
3. Workspace yaratma → ekip üyesi davet → davet kabul akışı çalışıyor
4. `/w/:slug/...` URL'i workspace erişimi olmayan kullanıcı için 403 dönüyor
5. `@RequirePermission('campaign:write')` decorator'lı endpoint'e VIEWER role'lü kullanıcı 403 alıyor
6. Access token 15 dakika sonra expire oluyor, refresh token ile seamless yenileniyor
7. Logout → hem access hem refresh invalidate ediliyor, aynı token bir daha kullanılamıyor
8. MFA olmadan login tamamlanmıyor — password doğru olsa bile MFA step'i zorunlu
9. Aktif cihazlar listesinden herhangi bir session revoke edilebiliyor
10. Rate limiting aktif: 5 başarısız login → 15 dakika lockout

---

## 2. Önceki modüllere bağımlılık

Module 01 tamamlanmış olmalı. Özellikle:
- `packages/database` — Prisma setup, migration pipeline
- `apps/api/src/common/crypto/` — AES-256-GCM crypto service
- `apps/api/src/common/` — Pino logger, validation pipe, helmet
- Redis çalışır durumda (BullMQ + cache için)
- Health check endpoint'leri (service status göstermek için)

---

## 3. User stories

### End-user stories (senin ekibin)

- **Developer olarak**, ilk kez giriş yaparken MFA setup'ı zorunlu olsun ki hesabım güvende olsun.
- **Account manager olarak**, birden fazla workspace'e erişimim var; URL'den hangi workspace'te olduğumu anlayabileyim.
- **Team lead olarak**, ekibime yeni üye davet edebilip onlara workspace bazlı rol atayabileyim.
- **Her kullanıcı olarak**, şifremi unuttuğumda email üzerinden reset edebileyim.
- **Güvenlik bilinci olan kullanıcı olarak**, aktif cihazlarımı görüp şüpheli olanları uzaktan logout edebileyim.
- **Kullanıcı olarak**, uzun bir oturumda aktif olsam bile güvenlik için belirli aralıklarla yeniden doğrulama yapmak zorunda kalmayayım (refresh token bunu çözecek).

### Developer stories

- **Backend developer olarak**, her controller'da boilerplate auth kontrolü yazmak yerine `@CurrentUser()` ve `@CurrentWorkspace()` decorator'ları ile bu bilgiye erişmek istiyorum.
- **Backend developer olarak**, bir endpoint'i korumak için tek satırda `@RequirePermission('campaign:write')` yazmak istiyorum.
- **Frontend developer olarak**, permission kontrolü için `useCan('campaign:write')` hook'u ile conditional rendering yapmak istiyorum.

---

(Full spec kept in repository for reference — see original message for complete content.)
