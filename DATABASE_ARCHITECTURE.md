# Архитектура подключения к базе данных

## Общая схема

```
Master Process (master.js)
    ↓
    ├─ Единое подключение к MongoDB (database.js - singleton)
    ↓
    ├─ Worker Threads (используют общее подключение)
    │   ├─ subscriptionsWorker.js (обработка подписок)
    │   └─ processingWorker.js (обработка очереди контента)
    ↓
    └─ Spawn Processes (создают свои подключения)
        ├─ telegramBot.js (долгоживущий)
        └─ mediaManager.js (по расписанию)
```

## Файловая структура

### Новые файлы (используются master.js):
- **database.js** - централизованный модуль для работы с БД (singleton)
- **subscriptionsWorker.js** - worker thread для обработки подписок
- **processingWorker.js** - worker thread для обработки очереди

### Старые файлы (для тестирования):
- **subscriptionsProcess_v2.js** - standalone процесс, использует database.js
- **contentProcessing.js** - standalone процесс, использует database.js
- **runContentProcessing.js** - standalone процесс, использует database.js

### Устаревшие файлы:
- **base.js** - старый модуль БД (можно удалить после полной миграции)

## Переменные окружения

```env
# База данных
baseUrl=mongodb://user:password@host:port/database

# Окружение
environment=prod  # или dev

# Логирование MongoDB
MONGODB_VERBOSE=true   # Показывать подключения/отключения
MONGODB_DEBUG=true     # Детальная отладка
```

## Как это работает

### 1. Master запуск
```bash
npm start  # или node master.js
```

Master процесс:
1. Создает подключение к MongoDB один раз
2. Запускает worker threads для subscription задач
3. Запускает worker thread для processing очереди
4. Запускает долгоживущие spawn процессы (bot, etc)

### 2. Worker Threads
Worker threads работают в том же процессе что и master:
- Переиспользуют существующее подключение к БД
- Не создают лишние подключения/отключения
- Работают параллельно без конфликтов

### 3. Тестирование (standalone)
```bash
npm run test-user      # subscriptionsProcess_v2.js
npm run test-telegram  # subscriptionsProcess_v2.js
npm run test-video     # subscriptionsProcess_v2.js
```

Standalone процессы:
- Создают свое подключение к БД
- Закрывают его после завершения работы
- Используют database.js (новый модуль)

## Преимущества новой архитектуры

✅ **Производительность**
- Одно подключение вместо множества
- Connection pooling работает эффективно
- Меньше нагрузка на MongoDB сервер

✅ **Стабильность**
- Автоматическое переподключение при сбоях
- Мониторинг здоровья соединения
- Graceful shutdown

✅ **Чистые логи**
- Нет лишних "topology closed"
- Контролируемое логирование через env переменные
- Понятная структура сообщений

✅ **Поддерживаемость**
- Весь код БД в одном месте (database.js)
- Простой API для работы с данными
- Легко добавлять новые функции

## Миграция с base.js на database.js

### Было:
```javascript
import BaseClient from './base.js';
const base = new BaseClient(true);

await base.connect();
const data = await base.getContentFromQ();
await base.closeConnection();
```

### Стало:
```javascript
import { 
  connectDatabase, 
  getContentFromQ,
  setupGracefulShutdown
} from './database.js';

await connectDatabase();
const data = await getContentFromQ();
setupGracefulShutdown();
```

## Мониторинг

### Проверка подключения
При запуске master процесса вы увидите:
```
✓ Master connected to MongoDB
✓ Processing worker ready
==========================================
====== APPLICATION HAS BEEN STARTED ======
==========================================
```

### Логи работы
```
Subscriptions Count = 5 | Country = pl | Time = 10:00 | Collection = subscriptions-users
=================
== Items In Q = 5
== RUN: CONTENT PROCESSING ==
== [ 10:00 ] [ pl ] [ subscriptions-users ]
== EXECUTION TIME: [ 2 ]
== END: CONTENT PROCESSING ==
```

### Debug режим
С `MONGODB_DEBUG=true`:
```
[MongoDB] Connecting to MongoDB...
[MongoDB] Connection already established (fast path)
[MongoDB] MongoDB heartbeat succeeded
```
