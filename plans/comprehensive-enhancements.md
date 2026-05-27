# Комплексные улучшения Aura - Полный план

## Обзор
Полная модернизация приложения Aura с добавлением всех запрашиваемых функций, вдохновлённых лучшими практиками Telegram и другими современными мессенджерами.

## 1. Расширение Aura Prime

### Текущие функции (сохранить и улучшить):
- Эксклюзивные темы и значки
- Анимированные аватары
- Большие файлы (до 4GB)
- Эксклюзивные реакции
- Привязка Telegram

### Новые премиум-функции:

#### Профиль и приватность:
- **Кастомные фоны профиля** (реализовано в плане)
- **Расширенная информация о профиле** (номер телефона, верификация, биография)
- **Приоритетная поддержка** (значок в профиле)
- **Скрытие онлайн-статуса** (для выбранных пользователей)
- **Неограниченное количество чатов** (для обычных - лимит 200)

#### Медиа и контент:
- **Увеличенный лимит сторисов** (1 в день для обычных, 10 для Prime)
- **Архив сторисов** (доступ к старым сторисам)
- **Увеличенная длительность видео-кружков** (1 минута → 5 минут)
- **Без ограничений на размер загружаемых файлов** (4GB для Prime)
- **HD качество видео** (автоматическое улучшение)

#### Сообщения и чаты:
- **Расширенные возможности редактирования** (до 48 часов)
- **Безлимитные реакции** (обычные - 5 реакций/сообщение)
- **Голосовые сообщения до 1 часа** (обычные - 15 минут)
- **Прикрепление до 10 файлов** в одном сообщении (обычные - 5)
- **Создание чатов с до 1000 участников** (обычные - 200)

#### Безопасность:
- **Двухфакторная аутентификация** с аппаратными ключами
- **Защита от скриншотов** (уведомления)
- **Самоуничтожающиеся сообщения** (таймер до 1 недели)
- **Шифрованные резервные копии**

### UI для Aura Prime:
```typescript
// Обновить AuraPrimePanel.tsx
const PRIME_FEATURES = [
  { icon: '🎨', title: 'Эксклюзивные темы', premium: true },
  { icon: '👑', title: 'Значки Prime', premium: true },
  { icon: '✨', title: 'Анимированный аватар', premium: true },
  { icon: '📁', title: 'Файлы до 4 ГБ', premium: true },
  { icon: '🌟', title: 'Эксклюзивные реакции', premium: true },
  { icon: '🔗', title: 'Привязка Telegram', premium: true },
  { icon: '📊', title: 'Расширенный профиль', premium: true },
  { icon: '🔒', title: 'Приоритетная поддержка', premium: true },
  { icon: '👻', title: 'Скрытие онлайн-статуса', premium: true },
  { icon: '📺', title: '10 сторисов в день', premium: true },
  { icon: '💾', title: 'Архив сторисов', premium: true },
  { icon: '⏱️', title: 'Редактирование до 48ч', premium: true },
];

const FREE_FEATURES = [
  { icon: '📱', title: 'Базовые чаты', free: true },
  { icon: '🖼️', title: 'Сторис 1 в день', free: true },
  { icon: '🎤', title: 'Голосовые до 15 мин', free: true },
  { icon: '📎', title: '5 файлов/сообщение', free: true },
  { icon: '👥', title: 'Чаты до 200 участников', free: true },
];
```

## 2. Ограничение сторисов (1 в день для обычных пользователей)

### Серверные изменения:
```typescript
// server/src/routes/stories.ts

// Проверка лимита сторисов
function checkStoryLimit(userId: string): boolean {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const today = now - (now % 86400); // Начало текущего дня
  
  const user = db.prepare('SELECT is_prime FROM users WHERE id = ?').get(userId);
  const limit = user?.is_prime ? 10 : 1; // 10 для Prime, 1 для обычных
  
  const count = db.prepare(
    'SELECT COUNT(*) as count FROM stories WHERE author_id = ? AND created_at >= ?'
  ).get(userId, today).count;
  
  return count < limit;
}

// Обновить POST /api/stories
router.post('/', authenticateToken, async (req, res) => {
  if (!checkStoryLimit(req.user!.userId)) {
    return res.status(429).json({ error: 'Daily story limit reached' });
  }
  // ... остальная логика
});
```

### UI изменения:
```typescript
// В StoryComposer.tsx добавить индикатор лимита
const [storyLimit, setStoryLimit] = useState({ limit: 1, used: 0 });

useEffect(() => {
  async function checkLimit() {
    const limitInfo = await api.getStoryLimit();
    setStoryLimit(limitInfo);
  }
  checkLimit();
}, []);

{storyLimit.used >= storyLimit.limit && (
  <div className="text-center py-4">
    <p className="text-sm text-aura-text-dim mb-2">
      Вы достигли лимита сторисов на сегодня
    </p>
    {!user?.isPrime && (
      <button 
        onClick={() => navigate('/settings/prime')}
        className="text-aura-primary text-sm hover:underline"
      >
        Обновиться до Prime для 10 сторисов/день
      </button>
    )}
  </div>
)}
```

## 3. Расширенная информация о пользователе (как в Telegram Premium)

### База данных:
```sql
-- Добавить новые поля в users
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN website TEXT;
ALTER TABLE users ADD COLUMN location TEXT;
ALTER TABLE users ADD COLUMN birthday TEXT;
ALTER TABLE users ADD COLUMN social_links TEXT; -- JSON
ALTER TABLE users ADD COLUMN join_date INTEGER DEFAULT (unixepoch());
ALTER TABLE users ADD COLUMN last_active INTEGER DEFAULT (unixepoch());
ALTER TABLE users ADD COLUMN profile_views INTEGER DEFAULT 0;
```

### Расширенный профиль:
```typescript
// Обновить UserProfile.tsx
function ExtendedUserProfile() {
  const [activeTab, setActiveTab] = useState<'about' | 'media' | 'common'>('about');
  
  return (
    <div className="space-y-6">
      {/* Основная информация */}
      <div className="text-center">
        <Avatar name={user.displayName} color={user.avatarColor} size={80} imageUrl={user.avatarUrl} />
        <h2 className="text-2xl font-bold mt-3">{user.displayName}</h2>
        <p className="text-aura-text-dim">@{user.username}</p>
        
        <div className="flex items-center justify-center gap-4 mt-2">
          {user.isPrime && <PrimePill user={user} />}
          {user.isAdmin && <AdminBadge />}
          {user.phoneVerified && <PhoneVerifiedBadge />}
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex border-b border-aura-border">
        <button 
          onClick={() => setActiveTab('about')}
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'about' ? 'text-aura-primary border-b-2 border-aura-primary' : 'text-aura-text-dim'}`}
        >
          О пользователе
        </button>
        <button 
          onClick={() => setActiveTab('media')}
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'media' ? 'text-aura-primary border-b-2 border-aura-primary' : 'text-aura-text-dim'}`}
        >
          Медиа
        </button>
        <button 
          onClick={() => setActiveTab('common')}
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'common' ? 'text-aura-primary border-b-2 border-aura-primary' : 'text-aura-text-dim'}`}
        >
          Общие
        </button>
      </div>

      {/* Контент вкладок */}
      {activeTab === 'about' && (
        <div className="space-y-4">
          {user.bio && (
            <div>
              <h3 className="text-sm font-semibold text-aura-text-dim uppercase tracking-wider mb-2">Биография</h3>
              <p className="text-sm text-aura-text-dim whitespace-pre-wrap">{user.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            {user.phone && (user.phoneVisibility === 'everyone' || isContact) && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-aura-text-muted" />
                <span>{user.phone}</span>
                {user.phoneVerified && <Check className="w-3 h-3 text-green-400" />}
              </div>
            )}

            {user.username && (
              <div className="flex items-center gap-2">
                <AtSign className="w-4 h-4 text-aura-text-muted" />
                <span>@{user.username}</span>
              </div>
            )}

            {user.website && (
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-aura-text-muted" />
                <a href={user.website} target="_blank" className="text-aura-primary hover:underline truncate">
                  {user.website.replace(/^https?://, '')}
                </a>
              </div>
            )}

            {user.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-aura-text-muted" />
                <span>{user.location}</span>
              </div>
            )}

            {user.birthday && (
              <div className="flex items-center gap-2">
                <Cake className="w-4 h-4 text-aura-text-muted" />
                <span>{formatBirthday(user.birthday)}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-aura-text-muted" />
              <span>В Aura с {formatDate(user.createdAt)}</span>
            </div>
          </div>

          {user.socialLinks && (
            <div>
              <h3 className="text-sm font-semibold text-aura-text-dim uppercase tracking-wider mb-2">Социальные сети</h3>
              <div className="flex gap-3">
                {Object.entries(user.socialLinks).map(([platform, url]) => (
                  <a key={platform} href={url} target="_blank" className="text-aura-text-dim hover:text-aura-text">
                    {getSocialIcon(platform)}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'media' && (
        <MediaGallery userId={user.id} />
      )}

      {activeTab === 'common' && (
        <CommonChats userId={user.id} />
      )}
    </div>
  );
}
```

## 4. Архив публикаций (сторисов)

### Серверная часть:
```typescript
// Новый endpoint для архива
router.get('/stories/archive', authenticateToken, (req, res) => {
  const db = getDb();
  
  // Для Prime пользователей - весь архив
  // Для обычных - последние 7 дней
  const user = db.prepare('SELECT is_prime FROM users WHERE id = ?').get(req.user!.userId);
  const limitDays = user?.is_prime ? 365 * 10 : 7; // 10 лет для Prime, 7 дней для обычных
  
  const cutoff = Math.floor(Date.now() / 1000) - (limitDays * 86400);
  
  const stories = db.prepare(
    'SELECT * FROM stories WHERE author_id = ? AND created_at >= ? ORDER BY created_at DESC'
  ).all(req.user!.userId, cutoff);
  
  res.json({ stories });
});
```

### UI компонент StoryArchive.tsx:
```typescript
function StoryArchive({ userId }: { userId: string }) {
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadArchive() {
      try {
        const data = await api.getStoryArchive(userId);
        setStories(data.stories);
      } catch (err) {
        setError('Не удалось загрузить архив');
      } finally {
        setLoading(false);
      }
    }
    loadArchive();
  }, [userId]);

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-aura-text-dim uppercase tracking-wider">
        Архив сторисов
      </h3>

      {stories.length === 0 ? (
        <div className="text-center py-8">
          <Archive className="w-12 h-12 text-aura-text-dim mx-auto mb-3" />
          <p className="text-aura-text-dim text-sm">
            Архив пуст
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {stories.map(story => (
            <button 
              key={story.id}
              onClick={() => openStory(story.id)}
              className="aspect-square relative rounded-lg overflow-hidden border border-aura-border"
            >
              {story.type === 'image' ? (
                <img src={story.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={story.thumbnail} className="w-full h-full object-cover" />
              )}
              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                {formatDate(story.createdAt)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 5. Интеграция ИИ

### Серверная часть:
```typescript
// server/src/routes/ai.ts

// Анализ сообщений
router.post('/analyze', authenticateToken, async (req, res) => {
  const { text } = req.body;
  
  try {
    // Интеграция с внешним ИИ сервисом
    const analysis = await aiService.analyzeText(text);
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

// Генерация ответов
router.post('/suggest-reply', authenticateToken, async (req, res) => {
  const { message, context } = req.body;
  
  try {
    const suggestions = await aiService.suggestReplies(message, context);
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

// Резюмирование чата
router.post('/summarize', authenticateToken, async (req, res) => {
  const { chatId } = req.body;
  
  try {
    const summary = await aiService.summarizeChat(chatId);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: 'Summarization failed' });
  }
});
```

### UI компоненты:

#### AIAssistant (уже существует, расширить):
```typescript
function EnhancedAIAssistant() {
  const [activeTab, setActiveTab] = useState<'chat' | 'analyze' | 'summarize'>('chat');
  
  return (
    <div className="flex h-full">
      {/* Боковая панель */}
      <div className="w-64 border-r border-aura-border p-4">
        <div className="space-y-2">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`w-full text-left p-3 rounded-lg ${activeTab === 'chat' ? 'bg-aura-primary-dim' : 'hover:bg-aura-surface2'}`}
          >
            <MessageCircle className="w-4 h-4 inline mr-2" />
            Частный ИИ-чат
          </button>
          
          <button 
            onClick={() => setActiveTab('analyze')}
            className={`w-full text-left p-3 rounded-lg ${activeTab === 'analyze' ? 'bg-aura-primary-dim' : 'hover:bg-aura-surface2'}`}
          >
            <Scan className="w-4 h-4 inline mr-2" />
            Анализ сообщений
          </button>
          
          <button 
            onClick={() => setActiveTab('summarize')}
            className={`w-full text-left p-3 rounded-lg ${activeTab === 'summarize' ? 'bg-aura-primary-dim' : 'hover:bg-aura-surface2'}`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Резюме чата
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 p-4">
        {activeTab === 'chat' && <AIChat />}
        {activeTab === 'analyze' && <MessageAnalyzer />}
        {activeTab === 'summarize' && <ChatSummarizer />}
      </div>
    </div>
  );
}
```

#### Интеграция в MessageInput:
```typescript
{/* AI Suggest Button */}
<button
  onClick={analyzeMessage}
  disabled={!text.trim() || uploading}
  className="p-2 rounded-lg hover:bg-aura-surface2 transition-colors text-aura-text-dim hover:text-aura-primary"
  title="Проанализировать сообщение"
>
  <Sparkles className="w-5 h-5" />
</button>

{aiSuggestions.length > 0 && (
  <div className="mt-2 space-y-1">
    {aiSuggestions.map((suggestion, index) => (
      <button
        key={index}
        onClick={() => setText(suggestion)}
        className="block w-full text-left p-2 rounded-lg bg-aura-surface2 hover:bg-aura-elevated text-sm"
      >
        {suggestion}
      </button>
    ))}
  </div>
)}
```

## 6. Полная интеграция всех функций

### Обновление типов:
```typescript
// client/src/types/index.ts
export interface User {
  // ... существующие поля
  bio?: string;
  website?: string;
  location?: string;
  birthday?: string;
  socialLinks?: Record<string, string>;
  joinDate?: number;
  lastActive?: number;
  profileViews?: number;
  isPrime?: boolean;
  primeFeatures?: {
    customBackground?: string;
    extendedProfile?: boolean;
    unlimitedStories?: boolean;
    storyArchive?: boolean;
    hdVideo?: boolean;
    prioritySupport?: boolean;
  };
}
```

### Обновление контекста аутентификации:
```typescript
// client/src/contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  updateUser: (user: User) => void;
  syncContacts: () => Promise<void>;
  generateInviteLink: () => Promise<string>;
  checkPrimeStatus: () => Promise<boolean>;
}
```

## План реализации

### Фаза 1: Aura Prime и ограничения
1. Обновить базу данных для новых премиум-функций
2. Обновить серверные endpoints
3. Обновить UI компоненты для отображения новых функций
4. Реализовать ограничение на сторисов

### Фаза 2: Расширенные профили
1. Добавить новые поля в базу данных
2. Обновить формы редактирования профиля
3. Создать новые UI компоненты для расширенного профиля
4. Интегрировать с существующими компонентами

### Фаза 3: Архив сторисов
1. Создать серверные endpoints
2. Разработать UI компонент архива
3. Интегрировать с профилями пользователей
4. Добавить настройки видимости архива

### Фаза 4: Интеграция ИИ
1. Настроить серверную интеграцию с ИИ сервисами
2. Создать UI компоненты для ИИ функций
3. Интегрировать с существующими чатами
4. Добавить настройки ИИ в профиль

### Фаза 5: Тестирование и оптимизация
1. Тестирование всех новых функций
2. Оптимизация производительности
3. Исправление ошибок
4. Документирование

## Оценка времени
- Фаза 1: 2-3 дня
- Фаза 2: 3-4 дня
- Фаза 3: 2 дня
- Фаза 4: 4-5 дней
- Фаза 5: 3 дня

Общее время: ~2 недели интенсивной разработки