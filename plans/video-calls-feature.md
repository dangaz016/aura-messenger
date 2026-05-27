# Видео-звонки с высоким качеством - План реализации

## Текущее состояние
В приложении уже реализована система голосовых звонков с использованием WebRTC:
- Базовый функционал: установка соединения, передача аудио
- UI компоненты: CallButton, ActiveCallModal, IncomingCallModal
- Hook: useCall с полным циклом работы звонка
- Socket обработчики: сигнализация WebRTC через сокеты

## Необходимые изменения

### 1. Обновление хука useCall
- Добавить поддержку видео-потоков
- Добавить переключение между аудио и видео режимами
- Добавить управление видеопотоком (включение/выключение камеры)

### 2. Изменения в UI компонентах
- Добавить отображение видео в ActiveCallModal
- Добавить кнопку переключения камеры
- Добавить индикаторы состояния видео
- Обновить стили для видео-режима

### 3. Обновление сокет-обработчиков
- Добавить передачу информации о видео-возможностях
- Добавить обработку смены режимов во время звонка

### 4. Новые функции
- Выбор устройства камеры
- Настройка качества видео
- Оптимизация пропускной способности
- Адаптивный UI для разных размеров экранов

## Детальный план

### Шаг 1: Обновление useCall.ts
```typescript
// Добавить в getUserMedia
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
  }
});

// Добавить функции управления видео
const toggleVideo = useCallback(() => {
  if (localStreamRef.current) {
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(!videoTrack.enabled);
    }
  }
}, []);

// Добавить функции смены камеры
const switchCamera = useCallback(async () => {
  // Реализация смены камеры
}, []);
```

### Шаг 2: Обновление ActiveCallModal.tsx
```typescript
// Добавить отображение видео-потоков
{localStream && (
  <video 
    ref={localVideoRef} 
    autoPlay 
    playsInline 
    muted 
    className="w-32 h-24 rounded-lg absolute bottom-4 right-4 object-cover border-2 border-aura-surface"
  />
)}

{remoteStream && (
  <video 
    ref={remoteVideoRef}
    autoPlay 
    playsInline 
    className="w-full h-full object-cover rounded-2xl"
  />
)}

// Добавить кнопку управления видео
<button onClick={toggleVideo} className="group flex flex-col items-center gap-3">
  <div className={`w-14 h-14 rounded-full transition-all flex items-center justify-center group-hover:scale-110 ${
    isVideoEnabled 
      ? 'bg-aura-surface2 hover:bg-aura-surface3'
      : 'bg-red-500/20 border-2 border-red-500'
  }`}>
    {isVideoEnabled ? (
      <Video className="w-6 h-6 text-aura-text" />
    ) : (
      <VideoOff className="w-6 h-6 text-red-500" />
    )}
  </div>
  <span className="text-xs text-aura-text-dim">
    {isVideoEnabled ? 'Выкл. видео' : 'Вкл. видео'}
  </span>
</button>
```

### Шаг 3: Обновление сокет-обработчиков
```typescript
// Добавить передачу информации о видео-возможностях
socket.on('call:offer', (data: { 
  targetUserId: string; 
  offer: unknown; 
  callerName: string;
  hasVideo: boolean; // Новое поле
}) => {
  // ... существующая логика
  io.to(sid).emit('call:offer', {
    callerId: socket.userId,
    callerName: data.callerName,
    offer: data.offer,
    hasVideo: data.hasVideo, // Передача информации о видео
  });
};
```

## Тестирование
1. Тестирование установки видео-соединения
2. Тестирование переключения между аудио и видео
3. Тестирование на разных устройствах и браузерах
4. Тестирование адаптивности UI
5. Тестирование производительности и качества видео

## Будущие улучшения
1. Добавить возможность записи видео-звонков
2. Добавить транскрипцию разговоров
3. Добавить виртуальные фоны
4. Добавить эффекты и фильтры для видео
5. Добавить групповой видео-чат