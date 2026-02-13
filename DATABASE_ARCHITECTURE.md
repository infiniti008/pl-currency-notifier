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
- **test.js** - wrapper для тестирования workers

### Старые файлы (deprecated, не используются в production):
- **_subscriptionsProcess_v2.js** - standalone процесс (deprecated)
- **_subscriptionsProcess.js** - старый standalone процесс (deprecated)
- **_contentProcessing.js** - standalone процесс (deprecated)
- **_runContentProcessing.js** - standalone процесс (deprecated)
- **_base.js** - старый модуль БД (deprecated)

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

### 3. Тестирование (через test wrapper)
```bash
npm run test-user      # test.js -> subscriptionsWorker.js
npm run test-telegram  # test.js -> subscriptionsWorker.js
npm run test-video     # test.js -> subscriptionsWorker.js
```

Test wrapper:
- Подключается к БД один раз
- Запускает нужный worker с параметрами
- Использует ту же логику что и production
- Показывает понятный вывод результатов

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

## Миграция на database.js

### Было (старый base.js):
```javascript
import BaseClient from './base.js';
const base = new BaseClient(true);

await base.connect();
const data = await base.getContentFromQ();
await base.closeConnection();
```

### Стало (новый database.js):
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

## Тестирование

### Вручную запустить тест:
```bash
# Тест подписок пользователей
node test.js --country pl --collection subscriptions-users --time 08:00

# Тест конкретной подписки по ID
node test.js --country pl --collection subscriptions-users --id 507f1f77bcf86cd799439011

# Тест видео подписок
node test.js --country by --collection subscriptions-video --time 17:15
```

### Через npm scripts:
```bash
npm run test-user
npm run test-telegram
npm run test-video
npm run test-stories
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
