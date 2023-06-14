import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import { Command } from'commander';

const program = new Command();

program
  .option('-c, --country <country>', 'Country')
  .option('-t, --time <time>', 'Time')
  .option('-tp, --template <template>', 'Template')
  .option('-sc, --collection <collection>', 'Collection')
  .parse(process.argv);

const options = program.opts();

import {
  initBase,
  closeConnection,
  getAllSubscriptionsWithTimeByCountry,
  getLastCurrencies,
  getDiffCurrencies
} from './base.js';
import generators from "./renders.js";
import { sendPhoto } from './sendPhoto.js';

async function userSubscriptionsProcess() {
  try {
    // -- Set Time Zone
    if (options.country === 'by') {
      process.env.TZ = 'Europe/Minsk';
    } else if(options.country === 'pl') {
      process.env.TZ = 'Europe/Warsaw';
    }

    await initBase();
    // -- Get Time
    const now = new Date();
    let time = now.toLocaleTimeString(['ru-RU']).split(':').map(i => i.length === 2 ? i : '0' + i).join(':').slice(0, 5);
    if (options.time) {
      time = options.time;
    }

    // -- Get Subscriptions
    const allSubscriptionsWithTimeByCountry = await getAllSubscriptionsWithTimeByCountry(time, options.country, options.collection);

    if (!allSubscriptionsWithTimeByCountry) {
      await end();
      return;
    }

    // -- Get Last Rates
    const lastCurrencies = await getLastCurrencies(options.country);
    if (!lastCurrencies) {
      await end();
      return;
    }

    // -- Fill Subscriptions by Data
    for(let i = 0; i < allSubscriptionsWithTimeByCountry.length; i++) {
      const item = allSubscriptionsWithTimeByCountry[i];
      item.lastCurrencies = {};
      item.diffCurrencies = {};
      item.now = time;

      // -- Get Values to Diff
      const timeToGetDiff = getTimeToGetDiff(time, item.times);
      const targetTimeToDiff = now.valueOf() - timeToGetDiff;
      const diffCurrencies = await getDiffCurrencies(options.country, item.keys, targetTimeToDiff);

      item.keys = item.keys.filter(key => {
        return lastCurrencies.some(lastCurrency => lastCurrency.key === key);
      });

      item.keys.forEach(key => {
        // -- Add last values to subscription data
        item.lastCurrencies[key] = lastCurrencies.find(lastCurrencie => lastCurrencie.key === key);

        // -- Add Diff values to subscription data
        item.diffCurrencies[key] = diffCurrencies.find(diffCurrencie => diffCurrencie.key === key);
      });
    }

    // -- Prepare Content to Render
    const cotentToSubscriptions = allSubscriptionsWithTimeByCountry.map(subscriptionData => prepareContentToRender(subscriptionData, now));

    // -- Proccess Images
    console.log(`Subscriptions Count = ${cotentToSubscriptions.length} | Country = ${options.country} | Time = ${time}`)
    const processImagesArray = [];
    cotentToSubscriptions.forEach(content => {
      processImagesArray.push(processImages(content, content.template));
    });

    await Promise.all(processImagesArray);

    await end();
  } catch(err) {
    console.log(err);
    await end();
  }
}

async function end() {
  await closeConnection();
}

function getTimeToGetDiff(time, intervals) {
  try {
    const currentTimeIndex = intervals.indexOf(time);
    let previousTimeIndex = currentTimeIndex - 1;
    
    if (previousTimeIndex < 0) {
      previousTimeIndex = intervals.length - 1;
    }

    const previousTime = intervals[previousTimeIndex];

    const timeInMinutes = getTimeMinutes(time);

    const previousTimeInMinutes = getTimeMinutes(previousTime);

    let diffInMinutes = timeInMinutes - previousTimeInMinutes;
    if (previousTimeIndex > currentTimeIndex) {
      diffInMinutes = timeInMinutes + (1440 - previousTimeInMinutes);
    }
    const diff = diffInMinutes * 1000 * 60;

    return diff;
  } catch(err) {
    console.log(err);
    return 1000 * 60 * 60 * 4;
  }
}

function getTimeMinutes(time) {
   const splitedTime = time.split(':');
   const hours = parseInt(splitedTime[0]);
   const minutes = parseInt(splitedTime[1]);

   return hours * 60 + minutes;
}

function getSubscriptionColor(interval) {
  switch (interval) {
    case 'every-1-hours':
      return '#A459D1';
    case 'every-2-hours':
      return '#F99B7D';
    case 'every-4-hours':
      return '#088395';
    case 'every-6-hours':
      return '#5C469C';
    case 'every-12-hours':
      return '#19A7CE';
    case 'every-24-hours':
      return '#E55807';
    default:
      return '#088395';
  }
}

function getSubscriptionName(interval) {
  switch (interval) {
    case 'every-4-hours':
      return '4 Hour Updates';
    case 'every-24-hours':
      return '24 Hour Updates';
    default:
      return 'Updates';
  }
}

function getArrowClass(operation) {
  let oClass = 'arrow-center';

  if (operation?.toLowerCase() === 'buy' ) {
    oClass = 'arrow-right';
  } else if (operation?.toLowerCase() === 'sell' ) {
    oClass = 'arrow-left';
  }

  return oClass;
}

function getTemplate(interval) {
  if (options.template) {
    return options.template;
  }

  switch (interval) {
    case 'every-4-hours':
      return 'hourly-v1';
    case 'every-24-hours':
      return 'hourly-v1';
    default:
      return 'hourly-v1';
  }
}

function prepareContentToRender(subscription, now) {
  const date = now.toLocaleDateString('ru-RU');
  const connect = {
    records: [],
    id: subscription._id.toString(),
    name: subscription.name || getSubscriptionName(subscription.interval),
    color: subscription.color || getSubscriptionColor(subscription.interval),
    time: subscription.now,
    date,
    fileName: date + '-' + subscription.now + '-' + subscription._id.toString(),
    template: getTemplate(subscription.interval),
    chatId: subscription.userId
  };

  subscription.keys.forEach(key => {
    try {
      const LAST_VALUE = subscription.lastCurrencies[key]?.value?.toFixed(4);
      const PREVIOUS_VALUE = subscription.diffCurrencies[key]?.value?.toFixed(4) || subscription.lastCurrencies[key]?.value?.toFixed(4);

      let DIFF = (LAST_VALUE - PREVIOUS_VALUE);
      const isDiffGreatNull = DIFF >= 0;
      DIFF = DIFF.toFixed(4);
      DIFF = isDiffGreatNull ? '+' + DIFF : DIFF; 
      const DIFF_STYLE = isDiffGreatNull ? 'diff-up' : 'diff-down';
      const delimiterDiff = DIFF.split('').findIndex(item => item !== '0' && item !== '.' && item !== '-' && item !== '+');

      const record = {
        TIME: subscription.now,
        KEY: key,
        BANK: subscription.lastCurrencies[key].bank,
        CURRENCY: subscription.lastCurrencies[key].currency,
        CURRENCY_BASE: subscription.lastCurrencies[key].currencyBase,
        OPERATION: subscription.lastCurrencies[key].operation,
        LAST_VALUE,
        LAST_VALUE_S: LAST_VALUE.slice(0, 4),
        LAST_VALUE_E: LAST_VALUE.slice(4, 6),
        PREVIOUS_VALUE,
        PREVIOUS_VALUE_S: PREVIOUS_VALUE.slice(0, 4),
        PREVIOUS_VALUE_E: PREVIOUS_VALUE.slice(4, 6),
        PREVIOUS_TIME: subscription.diffCurrencies[key].date,
        DIFF,
        DIFF_S: DIFF.slice(0, delimiterDiff),
        DIFF_E: DIFF.slice(delimiterDiff, 7),
        DIFF_STYLE,
        NAME: subscription.lastCurrencies[key].name,
        COLOR: subscription.lastCurrencies[key].bankColor,
        ARROW_CLASS: getArrowClass(subscription.lastCurrencies[key].operation)
      };

      connect.records.push(record);
    } catch (err) {
      console.log('KEY PROCESS ERROR:', key)
      console.log(err);
    }
  });

  // console.log(JSON.stringify(connect));

  return connect;
}

function processImages(content) {
  return new Promise(async(resolve, reject) => {
    try {
      // -- Render Image
      const renderedImage = await generators.base64(content, content.template);
      if (!renderedImage) {
        reject(false);
        return;
      }

      // Send Image
      await sendPhoto(new Buffer.from(renderedImage, 'base64'), content.chatId);
      // console.log('sentPhoto', sentPhoto);
      
      resolve(true);
    } catch(err) {
      console.log(err);
      reject(false);
    }
  });
}

userSubscriptionsProcess();