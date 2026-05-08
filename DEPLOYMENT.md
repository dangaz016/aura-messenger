# Aura Messenger — Deployment Guide

> Aura состоит из **двух частей**: frontend (статика) и backend (Node.js + WebSockets + SQLite).
>
> **Netlify умеет хостить только frontend.** Backend нужно деплоить отдельно (Render / Railway / Fly.io).

---

## TL;DR — самая простая схема

| Часть | Куда деплоим | Стоимость |
|-------|--------------|-----------|
| Frontend (`client/`) | **Netlify** | бесплатно |
| Backend (`server/`)  | **Render.com** | бесплатно (с ограничениями) |

Дальше — пошагово.

---

## Шаг 0 — подготовка GitHub

И Netlify, и Render деплоят из GitHub. Нужно:

1. Создай новый репозиторий на github.com (например, `aura-messenger`)
2. Открой PowerShell в папке `Desktop/Aura`:

```powershell
cd $env:USERPROFILE\Desktop\Aura
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<твой-юзернейм>/aura-messenger.git
git push -u origin main
```

---

## Шаг 1 — деплой backend на Render.com

Backend нужно развернуть **первым**, потому что frontend будет ссылаться на его URL.

1. Зарегистрируйся на https://render.com (можно через GitHub)
2. Жми **New → Web Service**
3. Подключи свой репозиторий `aura-messenger`
4. Настройки:
   - **Name:** `aura-server` (или любое)
   - **Region:** Frankfurt (или ближайший)
   - **Branch:** `main`
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Раскрой **Advanced**, добавь Environment Variables:
   - `NODE_VERSION` = `22.11.0` (важно — для встроенного `node:sqlite`)
   - `JWT_SECRET` = жми **Generate** (Render сгенерит секрет)
   - `CORS_ORIGINS` = пока поставь `*`, потом заменишь на URL Netlify
   - `PORT` = `10000`
6. Жми **Create Web Service**

Render соберёт и запустит. Через 2-5 минут получишь URL вида:
`https://aura-server-xxxx.onrender.com`

**Скопируй этот URL — он понадобится для Netlify.**

Проверка: открой `https://aura-server-xxxx.onrender.com/api/health` — должно вернуть JSON со статусом `ok`.

> **Важно про free tier Render:** сервис засыпает через 15 минут неактивности и просыпается ~30 сек при первом запросе. Также SQLite-файл стирается при каждом редеплое (нет постоянного диска на free плане). Для прода нужен paid plan ($7/mo) или PostgreSQL.

---

## Шаг 2 — деплой frontend на Netlify

1. Зарегистрируйся на https://netlify.com (можно через GitHub)
2. **Add new site → Import an existing project → GitHub**
3. Выбери репо `aura-messenger`
4. Настройки билда:
   - **Base directory:** `client`
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `client/dist`
   - (Если у тебя в репо лежит `client/netlify.toml` — он подхватится автоматически с теми же настройками)
5. Раскрой **Show advanced → Environment variables**, добавь:
   - `VITE_API_URL` = URL backend с Render, например `https://aura-server-xxxx.onrender.com`
6. Жми **Deploy site**

Через минуту получишь URL вида `https://random-name-12345.netlify.app`.

Можешь поменять имя в **Site settings → Change site name** на что-то типа `aura-messenger`.

---

## Шаг 3 — настройка CORS

Теперь у тебя есть URL Netlify. Возвращайся в Render:

1. Открой свой `aura-server` в Render
2. **Environment** → отредактируй `CORS_ORIGINS`:
   ```
   https://aura-messenger.netlify.app,http://localhost:5173
   ```
   (через запятую, без пробелов)
3. Сохрани — Render автоматически перезапустит сервер

Готово. Заходи на свой Netlify URL и регистрируйся.

---

## Альтернативы для backend

### Railway.app
- $5 кредита бесплатно (сгорают)
- Поддерживает persistent volumes
- Быстрее чем Render
- Подключи GitHub-репо, выбери `server/` как root, добавь те же env vars

### Fly.io
- Free tier: 3 small VMs
- Persistent volumes есть
- Сложнее настройка, через CLI

### VPS (DigitalOcean / Hetzner / Timeweb)
- Полный контроль, $4-5/мес
- Нужно настроить nginx + pm2 + SSL вручную
- Подходит для прода

---

## Локальная разработка

```bash
# терминал 1 — backend
cd server
npm install
npm run dev    # http://localhost:3001

# терминал 2 — frontend
cd client
npm install
npm run dev    # http://localhost:5173
```

Для локалки Vite сам проксирует `/api` и `/socket.io` на `localhost:3001` — ничего настраивать не надо.

---

## Чек-лист перед публичным релизом

- [ ] `JWT_SECRET` сгенерирован случайно (не дефолт)
- [ ] `CORS_ORIGINS` указывает только на твой Netlify URL (не `*`)
- [ ] Перешёл на платный план Render или мигрировал на PostgreSQL (иначе данные пропадут)
- [ ] Подключил кастомный домен в Netlify (необязательно, но красиво)
- [ ] Проверил, что регистрация работает на проде
- [ ] Проверил, что real-time WebSocket работает (отправь сообщение в двух вкладках)

---

## Известные ограничения текущей реализации

- **SQLite на free tier Render** — данные пропадают при каждом деплое. Для прода — PostgreSQL.
- **Один инстанс** — масштабирования по горизонтали нет (Socket.io + in-memory state). Для масштаба нужен Redis adapter.
- **Файлы в файловой системе** — на бессерверных платформах не выживут. Для прода — S3/Backblaze B2.
- **Нет email-верификации** — любой может зарегаться с любым username.

Это всё решаемо, но не нужно для MVP.

---

## Команда

- **Founder & Lead Developer:** Angela Erar
