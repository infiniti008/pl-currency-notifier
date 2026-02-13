/**
 * @deprecated В production используется subscriptionsWorker.js
 * 
 * STANDALONE ПРОЦЕСС - только для тестирования!
 * 
 * Production использование:
 * - master.js -> subscriptionsWorker.js (worker threads, общее подключение к БД)
 * 
 * Этот файл используется ТОЛЬКО для:
 * - Тестирования: npm run test-user, test-telegram, test-video
 * - Ручного запуска конкретной подписки
 * - Отладки вне master процесса
 * 
 * ВНИМАНИЕ: Создает свое подключение к БД (не оптимально для production)
 */

import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

const silenceMode = process.env.silenceMode === 'true';

import { Command } from'commander';

const program = new Command();

program
  .option('-c, --country <country>', 'Country')
  .option('-t, --time <time>', 'Time')
  .option('-tp, --template <template>', 'Template')
  .option('-sc, --collection <collection>', 'Collection')
  .option('-sid, --id <id>', 'Subscription Id')
  .option('-dt, --datetime <datetime>', 'Date Time')
  .parse(process.argv);

const options = program.opts();

import { 
  connectDatabase, 
  closeDatabase, 
  getAllSubscriptionsByTimeByCountry,
  addContentToQ,
  setupGracefulShutdown
} from './database.js';

async function userSubscriptionsProcess() {
  try {
    // -- Set Time Zone
    if (options.country === 'by') {
      process.env.TZ = 'Europe/Minsk';
    } else if(options.country === 'pl') {
      process.env.TZ = 'Europe/Warsaw';
    }

    await connectDatabase();

    // -- Get Time
    const now = options.datetime ? new Date(options.datetime) : new Date();
    let time = now.toLocaleTimeString(['ru-RU']).split(':').map(i => i.length === 2 ? i : '0' + i).join(':').slice(0, 5);
    if (options.time) {
      time = options.time;
    }

    // -- Get Subscriptions
    let allSubscriptionsWithTimeByCountry = await getAllSubscriptionsByTimeByCountry(time, options.country, options.collection, options.id);

    if (!allSubscriptionsWithTimeByCountry) {
      return;
    }

    let dayOfWeek = now.getDay() - 1;
    if (dayOfWeek === -1) {
      dayOfWeek = 6;
    }

    allSubscriptionsWithTimeByCountry = allSubscriptionsWithTimeByCountry.filter((sub) => {
      if (sub.weekAvailability) {
        const weekAvailability = sub.weekAvailability?.split('');
        const availabilityIndex = dayOfWeek;
        const availabilityForToday = weekAvailability[availabilityIndex];

        if (availabilityForToday === '*') {
          return true;
        }

        return false;
      }

      return true;
    });

    if (allSubscriptionsWithTimeByCountry.length === 0) {
      if (!silenceMode) {
        console.log(`Subscriptions Count = ${allSubscriptionsWithTimeByCountry.length} | Country = ${options.country} | Time = ${time} | Collection = ${options.collection}`);
      }
      return;
    }

    // -- Proccess Images
    if (!silenceMode) {
      console.log(`Subscriptions Count = ${allSubscriptionsWithTimeByCountry.length} | Country = ${options.country} | Time = ${time} | Collection = ${options.collection}`);
    }

    const addToQArr = [];
    allSubscriptionsWithTimeByCountry.forEach((subscription) => {
      subscription.subscriptionId = subscription._id.toString();
      delete subscription._id;
      addToQArr.push(addContentToQ(subscription));
    });

    await Promise.all(addToQArr);
  } catch (err) {
    console.error('Error in userSubscriptionsProcess:', err.message);
    process.exit(1);
  }
}

// Настроить graceful shutdown
setupGracefulShutdown();

userSubscriptionsProcess();