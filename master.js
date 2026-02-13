
import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});
import { CronJob } from 'cron';
import { spawn } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { connectDatabase, setupGracefulShutdown } from './database.js';

/**
 * Master процесс управления приложением
 * 
 * АРХИТЕКТУРА:
 * - Master создает одно подключение к MongoDB
 * - Worker threads переиспользуют это подключение через singleton
 * - Короткоживущие задачи (subscriptions) работают как воркеры
 * - Долгоживущие задачи (bot, media manager) работают как spawn процессы
 * 
 * ПРЕИМУЩЕСТВА:
 * - Одно подключение к БД для всех subscription задач
 * - Нет лишних подключений/отключений
 * - Чистые логи без "topology closed"
 * - Лучшая производительность и использование ресурсов
 */

async function masterRun() {
  // Подключиться к БД один раз для всех воркеров
  try {
    await connectDatabase();
    console.log('✓ Master connected to MongoDB');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  // Настроить graceful shutdown
  setupGracefulShutdown();

  telegramBotJob();
  
  processingQJob();

  new CronJob(
    '*/1 * * * *',
    async function() {
      const now = new Date().toLocaleTimeString('ru-RU');
      console.log(`\n⏰ [${now}] Cron job triggered - checking subscriptions...`);
      
      try {
        userSubscriptionsJobPL();
        userSubscriptionsJobBY();

        telegramSubscriptionsJobPL();
        telegramSubscriptionsJobBY();

        videoSubscriptionsJobPL();
        videoSubscriptionsJobBY();

        // storiesSubscriptionsJobPL();
        // storiesSubscriptionsJobBY();
      } catch(err) {
        console.error('❌ Cron job error:', err);
      }
    },
    async function() {
      console.log('==========================================');
      console.log('===== EXIT JOB: User Subscriptions  ======');
      console.log('==========================================');
    },
    true,
    'Europe/Warsaw'
  );
  
  // new CronJob(
  //   '*/1 * * * *',
  //   async function() {
  //     console.log(`==== RUN JOB: Chanel Subscriptions  [ ${new Date().toLocaleTimeString()} ] ====`);
  //     telegramSubscriptionsJobPL();
  //     telegramSubscriptionsJobBY();

  //     videoSubscriptionsJobPL();
  //     videoSubscriptionsJobBY();

  //     // storiesSubscriptionsJobPL();
  //     // storiesSubscriptionsJobBY();
  //   },
  //   async function() {
  //     console.log('==========================================');
  //     console.log('==== EXIT JOB: Chanel Subscriptions  ====');
  //     console.log('==========================================');
  //   },
  //   true,
  //   'Europe/Warsaw'
  // );

  new CronJob(
    '0 4 * * 1',
    deleteMediaJob,
    async function() {
      console.log('==========================================');
      console.log('====  EXIT JOB: DELETE MEDIA  ===');
      console.log('==========================================');
    },
    true,
    'Europe/Warsaw'
  );

  console.log('==========================================');
  console.log('====== APPLICATION HAS BEEN STARTED ======');
  console.log('==========================================');
  console.log('⏰ Cron schedule: every minute');
  console.log('� Workers will run every minute to fetch fresh data');
  console.log('==========================================\n');
}

/**
 * Запустить подписочный воркер
 */
function runSubscriptionWorker(country, collection, time = null) {
  console.log(`🚀 Starting worker [${country}/${collection}]`);

  const worker = new Worker('./subscriptionsWorker.js', {
    workerData: { country, collection, time }
  });

  worker.on('message', (result) => {
    if (result.success) {
      console.log(`✓ Worker [${country}/${collection}] completed - processed ${result.count} subscriptions`);
    } else {
      console.error(`❌ Worker error [${country}/${collection}]:`, result.error);
    }
  });

  worker.on('error', (err) => {
    console.error(`❌ Worker error [${country}/${collection}]:`, err.message);
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Worker [${country}/${collection}] exited with code ${code}`);
    }
  });

  return worker;
}

async function userSubscriptionsJobPL() {
  runSubscriptionWorker('pl', 'subscriptions-users');
}

async function userSubscriptionsJobBY() {
  runSubscriptionWorker('by', 'subscriptions-users');
}

async function telegramSubscriptionsJobPL() {
  runSubscriptionWorker('pl', 'subscriptions-telegram');
}

async function telegramSubscriptionsJobBY() {
  runSubscriptionWorker('by', 'subscriptions-telegram');
}

async function videoSubscriptionsJobPL() {
  runSubscriptionWorker('pl', 'subscriptions-video');
}

async function videoSubscriptionsJobBY() {
  runSubscriptionWorker('by', 'subscriptions-video');
}

// Stories functions закомментированы в cron и не используются
// Если понадобятся - можно добавить через runSubscriptionWorker

async function deleteMediaJob() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: DELETE MEDIA ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const deleteMediaProcess = spawn('node', ['./mediaManager']);

  deleteMediaProcess.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  deleteMediaProcess.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  deleteMediaProcess.on('close', (code) => {
    console.log(`Delete media Process exited with code ${code}`);
    if (code === 0) {
      console.log('******************************************');
      console.log('***  EXIT JOB: DELETE MEDIA  ****');
      console.log(`********** ${time} **********`);
      console.log('******************************************');
    }
  });
}

async function telegramBotJob() {
  if (process.env.environment !== 'dev') { return; }
  
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: Telegram BOT ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const telegramBotJob = spawn('node', ['./telegramBot.js']);

  telegramBotJob.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  telegramBotJob.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  telegramBotJob.on('close', (code) => {
    console.log(`Telegram Bot Process exited with code ${code}`);
    if (code === 0) {
      console.log('******************************************');
      console.log('***  EXIT JOB: BOT  ****');
      console.log(`********** ${time} **********`);
      console.log('******************************************');
    }
  });
}

async function processingQJob() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: PROCESSING CONTENT FROM Q ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const processingWorker = new Worker('./processingWorker.js');

  processingWorker.on('message', (msg) => {
    if (msg.ready) {
      console.log('✓ Processing worker ready');
    } else if (msg.error) {
      console.error('Processing worker error:', msg.error);
    }
  });

  processingWorker.on('error', (err) => {
    console.error('Processing worker error:', err.message);
  });

  processingWorker.on('exit', (code) => {
    console.log('******************************************');
    console.log(`PROCESSING WORKER exited with code ${code}`);
    console.log('******************************************');
  });
}

masterRun();
