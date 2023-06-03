import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import { Command } from'commander';

const program = new Command();

program
  .option('-c, --country <country>', 'Country')
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
    const time = now.toLocaleTimeString(['ru-RU']).split(':').map(i => i.length === 2 ? i : '0' + i).join(':').slice(0, 5);
    // console.log('time', time);

    // -- Get Subscriptions
    const allSubscriptionsWithTimeByCountry = await getAllSubscriptionsWithTimeByCountry(time, options.country);

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
      const timeToGetDiff = getTimeToGetDiff(item.interval);
      const targetTimeToDiff = now.valueOf() - timeToGetDiff;
      const diffCurrencies = await getDiffCurrencies(options.country, item.keys, targetTimeToDiff);

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

function getTimeToGetDiff(interval) {
  switch (interval) {
    case 'every-4-hours':
      return 1000 * 60 * 60 * 4;
    case 'every-24-hours':
      return 1000 * 60 * 60 * 24;
  }
}

function getSubscriptionColor(interval) {
  switch (interval) {
    case 'every-4-hours':
      return '#088395';
    case 'every-24-hours':
      return '#E55807';
  }
}

function getSubscriptionName(interval) {
  switch (interval) {
    case 'every-4-hours':
      return '4 Hour Updates';
    case 'every-24-hours':
      return '24 Hour Updates';
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
  switch (interval) {
    case 'every-4-hours':
      return 'hourly-v1';
    case 'every-24-hours':
      return 'hourly-v1';
  }
}

function getFontWeight(interval) {
  let weight = '700';

  if (interval === 'every-24-hours') {
    weight = '400';
  }

  return weight;
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
    chatId: subscription.userId,
    fontWeight: getFontWeight(subscription.interval)
  };

  subscription.keys.forEach(key => {
    try {
      const LAST_VALUE = subscription.lastCurrencies[key].value.toFixed(4);
      const PREVIOUS_VALUE = subscription.diffCurrencies[key].value.toFixed(4);
      let DIFF = (LAST_VALUE - PREVIOUS_VALUE);
      const isDiffGreatNull = DIFF >= 0;
      DIFF = DIFF.toFixed(4);
      DIFF = isDiffGreatNull ? '+' + DIFF : DIFF; 
      const DIFF_STYLE = isDiffGreatNull ? 'diff-up' : 'diff-down';

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
        DIFF_S: DIFF.slice(0, 5),
        DIFF_E: DIFF.slice(5, 7),
        DIFF_STYLE,
        NAME: subscription.lastCurrencies[key].name,
        COLOR: subscription.lastCurrencies[key].bankColor,
        ARROW_CLASS: getArrowClass(subscription.lastCurrencies[key].operation)
      };

      connect.records.push(record);
    } catch (err) {
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