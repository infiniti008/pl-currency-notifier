import { parentPort, workerData } from 'node:worker_threads';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const silenceMode = process.env.silenceMode === 'true';

import { 
  connectDatabase, 
  getAllSubscriptionsByTimeByCountry,
  addContentToQ
} from './database.js';

/**
 * Worker для обработки подписок
 * Использует общее подключение к БД из главного процесса
 */
async function processSubscriptions() {
  try {
    const { country, collection, time, datetime, id } = workerData;

    // Set Time Zone
    if (country === 'by') {
      process.env.TZ = 'Europe/Minsk';
    } else if (country === 'pl') {
      process.env.TZ = 'Europe/Warsaw';
    }

    // Ensure connection (singleton переиспользует существующее подключение)
    await connectDatabase();

    // Get Time
    const now = datetime ? new Date(datetime) : new Date();
    let timeToUse = now.toLocaleTimeString(['ru-RU']).split(':').map(i => i.length === 2 ? i : '0' + i).join(':').slice(0, 5);
    if (time) {
      timeToUse = time;
    }

    // Get Subscriptions
    let allSubscriptionsWithTimeByCountry = await getAllSubscriptionsByTimeByCountry(timeToUse, country, collection, id);

    if (!allSubscriptionsWithTimeByCountry || allSubscriptionsWithTimeByCountry.length === 0) {
      if (!silenceMode && id) {
        console.log(`No subscriptions found | Country = ${country} | Time = ${timeToUse} | Collection = ${collection}`);
      }
      parentPort.postMessage({ success: true, count: 0 });
      return;
    }

    // Filter by week availability
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
        console.log(`Subscriptions Count = 0 (filtered) | Country = ${country} | Time = ${timeToUse} | Collection = ${collection}`);
      }
      parentPort.postMessage({ success: true, count: 0 });
      return;
    }

    // Process subscriptions
    if (!silenceMode) {
      console.log(`Subscriptions Count = ${allSubscriptionsWithTimeByCountry.length} | Country = ${country} | Time = ${timeToUse} | Collection = ${collection}`);
    }

    const addToQArr = [];
    allSubscriptionsWithTimeByCountry.forEach((subscription) => {
      subscription.subscriptionId = subscription._id.toString();
      delete subscription._id;
      addToQArr.push(addContentToQ(subscription));
    });

    await Promise.all(addToQArr);

    parentPort.postMessage({ 
      success: true, 
      count: allSubscriptionsWithTimeByCountry.length 
    });
  } catch (err) {
    console.error('Error in subscription worker:', err.message);
    parentPort.postMessage({ 
      success: false, 
      error: err.message 
    });
  }
}

processSubscriptions();
