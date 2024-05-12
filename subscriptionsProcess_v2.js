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

import BaseClient from './base.js';
const base = new BaseClient(true);

async function userSubscriptionsProcess() {
  try {
    // -- Set Time Zone
    if (options.country === 'by') {
      process.env.TZ = 'Europe/Minsk';
    } else if(options.country === 'pl') {
      process.env.TZ = 'Europe/Warsaw';
    }

    await base.connect();
    // -- Get Time
    const now = options.datetime ? new Date(options.datetime) : new Date();
    let time = now.toLocaleTimeString(['ru-RU']).split(':').map(i => i.length === 2 ? i : '0' + i).join(':').slice(0, 5);
    if (options.time) {
      time = options.time;
    }

    // -- Get Subscriptions
    let allSubscriptionsWithTimeByCountry = await base.getAllSubscriptionsByTimeByCountry(time, options.country, options.collection, options.id);

    if (!allSubscriptionsWithTimeByCountry) {
      await base.closeConnection();
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

      await base.closeConnection();
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
      addToQArr.push(base.addContentToQ(subscription));
    });

    await Promise.all(addToQArr);

    await base.closeConnection();
  } catch (err) {
    console.log(err);
    await base.closeConnection();
  }
}

userSubscriptionsProcess();