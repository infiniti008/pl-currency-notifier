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
    const time = now.toLocaleTimeString([], {
      hour12: false,
    }).split(':').map(i => i.length === 2 ? i : '0' + i).join(':').slice(0, 5);
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
    console.log(`Subscriptios Count = ${cotentToSubscriptions.length} | Country = ${options.country} | Time = ${time}`)
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
      return '#068DA9';
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

function getTemplate(interval) {
  switch (interval) {
    case 'every-4-hours':
      return 'every-4-hours';
    case 'every-24-hours':
      return 'every-4-hours'; // TODO - Update
  }
}

function prepareContentToRender(subscription, now) {
  const date = now.toLocaleDateString();
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
    const LAST_VALUE = subscription.lastCurrencies[key].value.toFixed(4);
    const PREVIOUS_VALUE = subscription.diffCurrencies[key].value.toFixed(4);
    const DIFF = (LAST_VALUE - PREVIOUS_VALUE).toFixed(4);
    const DIFF_STYLE = DIFF >= 0 ? 'diff-up' : 'diff-down';

    const record = {
      TIME: subscription.now,
      KEY: key,
      BANK: subscription.lastCurrencies[key].bank,
      CURRENCY: subscription.lastCurrencies[key].currency,
      CURRENCY_BASE: subscription.lastCurrencies[key].currencyBase,
      OPERATION: subscription.lastCurrencies[key].operation,
      LAST_VALUE,
      PREVIOUS_VALUE,
      PREVIOUS_TIME: subscription.diffCurrencies[key].date,
      DIFF,
      DIFF_STYLE
    };

    connect.records.push(record);
  });

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