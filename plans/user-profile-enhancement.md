# Расширение информации о пользователе - План улучшений

## Текущее состояние

В приложении уже реализована система профилей с:
- Базовой информацией о пользователе (имя, аватар, статус)
- Системой Aura Prime с премиальными функциями
- Возможностью редактирования профиля

## Необходимые улучшения

### 1. Отображение значка Prime
- Добавить визуальный индикатор премиум-статуса рядом с именем пользователя
- Отображать во всех компонентах: чаты, списки контактов, профили, модальные окна
- Использовать существующую систему primeBadge для консистентности

### 2. Отображение юзернеймов везде
- Заменить displayName на @username в местах, где это уместно
- Сохранить displayName для основного отображения
- Добавить @username как вторичную информацию

### 3. Добавление номера телефона
- Опциональное поле в профиле
- Возможность скрыть от других пользователей
- Валидация формата номера
- Опция подтверждения через SMS

## Детальный план реализации

### 1. Обновление базы данных

```sql
-- Добавить колонки для номера телефона и его видимости
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN phone_visibility TEXT DEFAULT 'nobody';
```

### 2. Обновление типов TypeScript

```typescript
// client/src/types/index.ts
export interface User {
  // ... существующие поля
  phone?: string | null;
  phoneVerified?: boolean;
  phoneVisibility?: PrivacyLevel; // 'everyone' | 'contacts' | 'nobody'
}
```

### 3. Обновление UI компонентов

#### UserProfile.tsx
```typescript
// Добавить отображение номера телефона с учётом видимости
{profile.phone && (profile.phoneVisibility === 'everyone' || (profile.phoneVisibility === 'contacts' && isContact)) && (
  <div className="flex items-center gap-2.5 text-sm text-aura-text-dim">
    <Phone className="w-4 h-4 text-aura-text-muted flex-shrink-0" />
    <span>{profile.phone}</span>
    {profile.phoneVerified && (
      <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">✓ Подтверждён</span>
    )}
  </div>
)}

// Добавить значок Prime рядом с именем
<div className="flex items-center gap-2 flex-wrap">
  <h2 className="text-xl font-bold leading-tight">{profile.displayName}</h2>
  {profile.isPrime && <PrimePill user={profile} />}
  {profile.isAdmin && (
    <span className="text-xs px-1.5 py-0.5 rounded bg-aura-primary/20 text-aura-primary-light flex items-center gap-1">
      <Shield className="w-3 h-3" /> Admin
    </span>
  )}
</div>
<div className="flex items-center gap-1 text-aura-text-muted hover:text-aura-text transition-colors text-sm mt-0.5">
  <Copy className="w-3.5 h-3.5" />
  @{profile.username}
</div>
```

#### ChatItem.tsx (для списка чатов)
```typescript
<div className="flex-1 min-w-0">
  <div className="flex items-center gap-2">
    <span className="font-medium truncate">{user.displayName}</span>
    {user.isPrime && <PrimePill user={user} size="sm" />}
  </div>
  <div className="flex items-center gap-1 text-xs text-aura-text-dim">
    <span>@{user.username}</span>
    {user.phoneVerified && <span className="text-green-400">✓</span>}
  </div>
</div>
```

#### Message.tsx (для сообщений)
```typescript
<div className="flex items-center gap-2">
  <span className="font-medium">{senderName}</span>
  {isPrime && <PrimePill user={user} size="xs" />}
  <span className="text-xs text-aura-text-dim">@{username}</span>
</div>
```

### 4. Добавление валидации телефона

```typescript
// Функция валидации номера телефона
function validatePhoneNumber(phone: string): boolean {
  // Международный формат с кодом страны
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

// Форматирование номера для отображения
function formatPhoneNumber(phone: string): string {
  // Добавить пробелы для удобства чтения
  return phone.replace(/(\d{3})(?=\d)/g, '$1 ');
}
```

### 5. Добавление подтверждения через SMS

#### Новый компонент PhoneVerificationModal.tsx
```typescript
interface PhoneVerificationModalProps {
  phoneNumber: string;
  onClose: () => void;
  onSuccess: (verifiedPhone: string) => void;
}

export function PhoneVerificationModal({ phoneNumber, onClose, onSuccess }: PhoneVerificationModalProps) {
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleSendCode() {
    setSending(true);
    setError('');
    try {
      await api.sendVerificationCode(phoneNumber);
      // Код отправлен
    } catch (err) {
      setError('Не удалось отправить код. Пожалуйста, попробуйте позже.');
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (code.length !== 6) {
      setError('Пожалуйста, введите 6-значный код');
      return;
    }

    try {
      const result = await api.verifyPhoneNumber(phoneNumber, code);
      onSuccess(result.phone);
    } catch (err) {
      setError('Неверный код. Пожалуйста, попробуйте ещё раз.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-aura-surface border border-aura-border rounded-2xl p-6 w-full max-w-sm">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold mb-2">Подтверждение телефона</h2>
          <p className="text-aura-text-dim text-sm">
            Мы отправили SMS с кодом на номер {formatPhoneNumber(phoneNumber)}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <input
                key={i}
                type="text"
                maxLength={1}
                value={code[i] || ''}
                onChange={(e) => {
                  const newCode = code.split('');
                  newCode[i] = e.target.value;
                  setCode(newCode.join(''));
                  if (e.target.value && i < 5) {
                    document.getElementById(`code-${i+1}`)?.focus();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !code[i] && i > 0) {
                    document.getElementById(`code-${i-1}`)?.focus();
                  }
                }}
                id={`code-${i}`}
                className="w-10 h-12 text-center text-xl bg-aura-surface2 border border-aura-border rounded-lg focus:border-aura-primary focus:ring-1 focus:ring-aura-primary outline-none"
              />
            ))}
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}

          <button
            onClick={handleVerify}
            disabled={code.length !== 6 || sending}
            className="w-full py-3 px-4 bg-aura-primary hover:bg-aura-primary-light text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            Подтвердить
          </button>

          <div className="text-center text-xs text-aura-text-muted">
            {timeLeft > 0 ? (
              <span>Отправить код повторно ({timeLeft}с)</span>
            ) : (
              <button
                onClick={handleSendCode}
                disabled={sending}
                className="text-aura-primary hover:underline"
              >
                Отправить код повторно
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 6. Обновление бэкенд API

#### Новые endpoints
```typescript
// server/src/routes/users.ts

// Отправить код подтверждения
router.post('/phone/send-code', authenticateToken, async (req, res) => {
  const { phone } = req.body;
  
  if (!phone || !validatePhoneNumber(phone)) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  // Проверка, не подтверждён ли уже этот номер другим пользователем
  const existing = db.prepare('SELECT id FROM users WHERE phone = ? AND phone_verified = 1').get(phone);
  if (existing) {
    return res.status(409).json({ error: 'Phone number already verified by another user' });
  }

  // Генерация и отправка кода
  const code = generateVerificationCode();
  
  try {
    // Здесь интеграция с SMS сервисом
    // await smsService.send(phone, `Your Aura verification code: ${code}`);
    
    // Сохранение кода в базе (с ограничением по времени)
    db.prepare('UPDATE users SET phone = ?, phone_verification_code = ?, phone_verification_expires = ? WHERE id = ?').run(
      phone, code, Math.floor(Date.now() / 1000) + 300, req.user!.userId
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('SMS send error:', err);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Подтвердить номер телефона
router.post('/phone/verify', authenticateToken, async (req, res) => {
  const { code } = req.body;
  
  if (!code || code.length !== 6) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  const user = db.prepare('SELECT phone, phone_verification_code, phone_verification_expires FROM users WHERE id = ?').get(req.user!.userId);
  
  if (!user.phone) {
    return res.status(400).json({ error: 'No phone number to verify' });
  }

  if (user.phone_verification_code !== code) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  if (user.phone_verification_expires < Math.floor(Date.now() / 1000)) {
    return res.status(400).json({ error: 'Verification code expired' });
  }

  // Подтверждение номера
  db.prepare('UPDATE users SET phone_verified = 1, phone_verification_code = NULL, phone_verification_expires = NULL WHERE id = ?').run(req.user!.userId);
  
  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId);
  res.json({ user: rowToPublicUser(updatedUser) });
});

// Обновить номер телефона
router.patch('/phone', authenticateToken, async (req, res) => {
  const { phone, visibility } = req.body;
  
  if (phone && !validatePhoneNumber(phone)) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  if (visibility && !['everyone', 'contacts', 'nobody'].includes(visibility)) {
    return res.status(400).json({ error: 'Invalid visibility setting' });
  }

  // Обновление номера телефона
  if (phone) {
    db.prepare('UPDATE users SET phone = ?, phone_verified = 0, phone_verification_code = NULL, phone_verification_expires = NULL WHERE id = ?').run(
      phone, req.user!.userId
    );
  }

  // Обновление видимости
  if (visibility) {
    db.prepare('UPDATE users SET phone_visibility = ? WHERE id = ?').run(visibility, req.user!.userId);
  }

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId);
  res.json({ user: rowToPublicUser(updatedUser) });
});
```

### 7. Обновление компонента редактирования профиля

Добавить в SettingsPanel или создать новый компонент PhoneSettingsPanel:
```typescript
function PhoneSettingsPanel() {
  const { user, updateUser } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [visibility, setVisibility] = useState(user?.phoneVisibility || 'nobody');
  const [showVerification, setShowVerification] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.updatePhone({ phone, visibility });
      updateUser(updated);
      
      // Если номер изменился и не подтверждён, показать модальное окно подтверждения
      if (phone !== user?.phone && phone && !updated.phoneVerified) {
        setShowVerification(true);
      }
    } catch (err) {
      // Показать ошибку
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-aura-text-dim uppercase tracking-wider mb-3">Номер телефона</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-aura-text-dim mb-1">
              Номер телефона (необязательно)
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+79123456789"
                className="input-aura w-full"
              />
              {user?.phoneVerified && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-xs text-green-400">
                  <Check className="w-3 h-3" /> Подтверждён
                </div>
              )}
            </div>
            <p className="text-xs text-aura-text-muted mt-1">
              Формат: +[код страны][номер без пробелов]
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-aura-text-dim mb-1">
              Кто может видеть ваш номер
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as PrivacyLevel)}
              className="input-aura w-full"
            >
              <option value="nobody">Никто</option>
              <option value="contacts">Только контакты</option>
              <option value="everyone">Все пользователи</option>
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="button-aura-primary w-full justify-center"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {showVerification && (
        <PhoneVerificationModal
          phoneNumber={phone}
          onClose={() => setShowVerification(false)}
          onSuccess={(verifiedPhone) => {
            setShowVerification(false);
            // Обновить пользователя с подтверждённым номером
          }}
        />
      )}
    </div>
  );
}
```

## Интеграция с существующими компонентами

### 1. Обновить UserProfilePanel
Добавить отображение номера телефона и значка Prime в основной панели профиля.

### 2. Обновить ChatWindow
Отображать значок Prime и @username в заголовке чата.

### 3. Обновить Sidebar
Добавить значки Prime и юзернеймы в списке чатов.

### 4. Обновить Message
Отображать юзернейм и значок Prime в сообщениях.

## Тестирование

1. Тестирование отображения значков Prime во всех компонентах
2. Тестирование отображения юзернеймов
3. Тестирование добавления и редактирования номера телефона
4. Тестирование подтверждения через SMS
5. Тестирование настроек видимости номера телефона
6. Тестирование консистентности UI

## Будущие улучшения

1. Добавить возможность поиска по номеру телефона
2. Добавить импорт контактов с телефона
3. Добавить синхронизацию контактов между устройствами
4. Добавить возможность скрыть номер от определённых пользователей
5. Добавить дополнительные методы подтверждения (звонок, мессенджеры)