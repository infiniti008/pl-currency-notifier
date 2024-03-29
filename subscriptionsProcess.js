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
  initBase,
  closeConnection,
  getAllSubscriptionsWithTimeByCountry,
  getLastCurrencies,
  getDiffCurrencies,
  addContentToQ,
  getRenderSettings,
  removeAllFromManagerQ
} from './base.js';

async function userSubscriptionsProcess() {
  try {
    // -- Set Time Zone
    if (options.country === 'by') {
      process.env.TZ = 'Europe/Minsk';
    } else if(options.country === 'pl') {
      process.env.TZ = 'Europe/Warsaw';
    }

    await initBase(true);
    // -- Get Time
    const now = options.datetime ? new Date(options.datetime) : new Date();
    let time = now.toLocaleTimeString(['ru-RU']).split(':').map(i => i.length === 2 ? i : '0' + i).join(':').slice(0, 5);
    if (options.time) {
      time = options.time;
    }

    // -- Get Subscriptions
    let allSubscriptionsWithTimeByCountry = await getAllSubscriptionsWithTimeByCountry(time, options.country, options.collection, options.id);

    if (!allSubscriptionsWithTimeByCountry) {
      await end();
      return;
    }

    const renderSettings = await prepareRenderSettings(options.collection, allSubscriptionsWithTimeByCountry[0])

    let dayOfWeek = now.getDay() - 1;
    if (dayOfWeek === -1) {
      dayOfWeek = 6;
    }

    if (!renderSettings.skipFilterByDay) {
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
          console.log('EMPTY SUBSCRIPTIONS LIST AFTER FILTERING', allSubscriptionsWithTimeByCountry);
        }

        if (options.collection == 'content-manager') {
          await removeAllFromManagerQ();
        }
        await end();
        return;
      }
    }

    const generalVideoSubscription = allSubscriptionsWithTimeByCountry.find(item => item.platform === 'subscriptions-video-all');
    if (generalVideoSubscription) {
      allSubscriptionsWithTimeByCountry = allSubscriptionsWithTimeByCountry.filter(item => item.platform !== 'subscriptions-video-all')
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
      if (item.platform !== 'subscriptions-telegram-promo') {
        
        item.lastCurrencies = {};
        item.diffCurrencies = {};
        item.now = time;

        // -- Get Values to Diff
        const timeToGetDiff = getTimeToGetDiff(time, item.times, item.timeToGetDiff, item.dayToGetDiff, now);
        const targetTimeToDiff = now.valueOf() - timeToGetDiff;
        item.targetTimeToDiff = targetTimeToDiff;
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
    }

    // -- Prepare Content to Render
    const cotentToSubscriptions = allSubscriptionsWithTimeByCountry.map(subscriptionData => {
      const content = prepareContentToRender(subscriptionData, now, time);
      return content;
    });

    // -- Proccess Images
    if (!silenceMode) {
      console.log(`Subscriptions Count = ${cotentToSubscriptions.length} | Country = ${options.country} | Time = ${time} | Collection = ${options.collection}`);
    }

    if (options.collection == 'subscriptions-video' && generalVideoSubscription) {
      const content = generalVideoSubscription;
      const sortedCotentToSubscriptions = sortVideoSubscriptions(content, cotentToSubscriptions);
      content.cotentToSubscriptions = sortedCotentToSubscriptions;

      generateName(content);
      generateDescription(content);

      delete content._id;
      content.renderSettings = renderSettings;
      await addContentToQ(content);
    }
    else {
      const addToQArr = [];
      cotentToSubscriptions.forEach((content) => {
        content.renderSettings = renderSettings;
        const hasAnyChanges = checkHasChanges(content);

        if (!content.doNotPostIfNoChanges || content.doNotPostIfNoChanges && hasAnyChanges) {
          addToQArr.push(addContentToQ(content));
        }
      });

      await Promise.all(addToQArr);
    }

    if (options.collection == 'content-manager') {
      await removeAllFromManagerQ();
    }

    await end();
  } catch (err) {
    console.log(err);
    await end();
  }
}

async function end() {
  await closeConnection(true);
}

function getTimeToGetDiff(time, intervals, timeToGetDiff, dayToGetDiff, now) {
  try {
    if (dayToGetDiff) {
      let diff = 1000 * 60;

      const dayDate = now.getDate();
      const dayDateToGetDiff = dayDate + dayToGetDiff;
      let newDate = new Date().setDate(dayDateToGetDiff);
      newDate = new Date(newDate).setHours(timeToGetDiff.split(':')[0]);
      newDate = new Date(newDate).setMinutes(timeToGetDiff.split(':')[1]);
      newDate = new Date(newDate).setSeconds(0);

      newDate = new Date(newDate);
      const diffMillis = now.valueOf() - newDate.valueOf();
      diff = diffMillis;

      return diff;
    }

    const currentTimeIndex = intervals.indexOf(time);
    let previousTimeIndex = currentTimeIndex - 1;
    
    if (previousTimeIndex < 0) {
      previousTimeIndex = intervals.length - 1;
    }

    const previousTime = timeToGetDiff ? timeToGetDiff : intervals[previousTimeIndex];

    const timeInMinutes = getTimeMinutes(time);

    const previousTimeInMinutes = getTimeMinutes(previousTime);

    let diffInMinutes = timeInMinutes - previousTimeInMinutes;
    if (!timeToGetDiff && previousTimeIndex >= currentTimeIndex) {
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

function getTemplate(platform) {
  if (options.template) {
    return options.template;
  }

  switch (platform) {
    case 'subscriptions-users':
      return 'subscriptions-users';
    case 'subscriptions-telegram':
      return 'subscriptions-users';
    case 'subscriptions-telegram-promo':
      return 'ask-donate';
    case 'subscriptions-video':
      return 'subscriptions-video';
    case 'subscriptions-stories':
      return 'subscriptions-stories';
    default:
      return 'subscriptions-users';
  }
}

function prepareContentToRender(subscription, now, time) {
  const date = now.toLocaleDateString('ru-RU');
  let fileName = date + '-' + (subscription.now ? subscription.now : time) + '-' + subscription._id.toString();
  if (subscription.MANAGER_FILE_NAME) {
    fileName = subscription.MANAGER_FILE_NAME;
  }

  const connect = {
    records: [],
    id: subscription._id.toString(),
    name: subscription.name || getSubscriptionName(subscription.interval),
    color: subscription.color || getSubscriptionColor(subscription.interval),
    time: subscription.now || time,
    date,
    dateTime: now.toLocaleString('ru-RU'),
    fileName,
    template: getTemplate(subscription.platform),
    chatId: subscription.userId,
    platform: subscription.platform,
    chanel: subscription.chanel,
    previousDateTime: new Date(subscription.targetTimeToDiff).toLocaleString(['ru-RU']),
    country: subscription.country,
    tag: '#' + subscription.name.replaceAll(' ', '_').replaceAll('|', '').replaceAll('-', ''),
    tags: subscription.tags,
    description: subscription.description,
    doNotPostIfNoChanges: subscription.doNotPostIfNoChanges
  };

  subscription.keys?.forEach(key => {
    try {
      const LAST_VALUE = subscription.lastCurrencies[key]?.value?.toFixed(4);
      const splitedLastValue = LAST_VALUE.split('.');
      const PREVIOUS_VALUE = subscription.diffCurrencies[key]?.value?.toFixed(4) || subscription.lastCurrencies[key]?.value?.toFixed(4);
      const splitedPreviousValue = PREVIOUS_VALUE.split('.');

      let DIFF = (LAST_VALUE - PREVIOUS_VALUE);
      const isDiffGreatNull = DIFF >= 0;
      DIFF = DIFF.toFixed(4);
      DIFF = isDiffGreatNull ? '+' + DIFF : DIFF;
      const DIFF_STYLE = isDiffGreatNull ? 'diff-up' : 'diff-down';
      let delimiterDiff = DIFF.split('').findIndex(item => item !== '0' && item !== '.' && item !== '-' && item !== '+');
      if (delimiterDiff < 0) {
        delimiterDiff = DIFF.length;
      }

      const record = {
        TIME: subscription.now,
        KEY: key,
        BANK: subscription.lastCurrencies[key].bank,
        CURRENCY: subscription.lastCurrencies[key].currency,
        CURRENCY_BASE: subscription.lastCurrencies[key].currencyBase,
        OPERATION: subscription.lastCurrencies[key].operation,
        LAST_VALUE,
        LAST_VALUE_S: `${splitedLastValue[0]}.${splitedLastValue[1][0]}${splitedLastValue[1][1]}`,
        LAST_VALUE_E: `${splitedLastValue[1][2]}${splitedLastValue[1][3]}`,
        PREVIOUS_VALUE,
        PREVIOUS_VALUE_S: `${splitedPreviousValue[0]}.${splitedPreviousValue[1][0]}${splitedPreviousValue[1][1]}`,
        PREVIOUS_VALUE_E: `${splitedPreviousValue[1][2]}${splitedPreviousValue[1][3]}`,
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
  // console.log(connect);
  // return null;

  return connect;
}

function generateName(content) {
  try {
    let videoTitle = '';

    videoTitle = content.titleTextTemplate;
    const dateTime = content.cotentToSubscriptions[0].dateTime.replace(', ', '-');
    videoTitle = videoTitle.replace('{{DATE_TIME}}', dateTime);
    
    content.videoTitle_youtube = videoTitle.replace('{{TITLE_TAGS}}', content.titleTags_youtube);
    content.videoTitle_instagram = videoTitle.replace('{{TITLE_TAGS}}', content.titleTags_instagram);
    content.videoTitle_tiktok = videoTitle.replace('{{TITLE_TAGS}}', content.titleTags_tiktok);
  } catch (err) {
    console.log(err);
    content.videoTitle_youtube = 'Name';
    content.videoTitle_instagram = 'Name';
    content.videoTitle_tiktok = 'Name';
  }
} 

function generateDescription(content) {
  try {
    // let videoDescription = content.description + '\r\n';
    
    // const allTags = content.cotentToSubscriptions.map(content => content?.tags).join(' ') + ' ' + content.tags;
    // videoDescription = videoDescription.replace('{{TAGS}}', allTags);
    // videoDescription = videoDescription.replace('{{DATE}}', content.cotentToSubscriptions[0].dateTime);
    
    // content.cotentToSubscriptions.forEach(content => {
    //   const keyNames = content.records.map(record => `- ${record.NAME} | ${record.CURRENCY} = ${record.LAST_VALUE} ${record.CURRENCY_BASE}`);

    //   videoDescription = videoDescription + keyNames.join(`\r\n`) + '\r\n\r\n';
    // });

    // videoDescription = videoDescription.replace(/\| Buy/g, '| Buy ');
    // videoDescription = videoDescription.replace(/\| AVG/g, '| AVG ');

    // videoDescription = videoDescription.trim();

    const allTags = content.tags + ' ' + content.cotentToSubscriptions.map(content => content?.tags).join(' ');
    const videoDescription = allTags + '\r\n\r\n' + content.description.join('\r\n');


    content.videoDescription = videoDescription;
  } catch (err) {
    console.log(err);
    content.videoDescription = 'Description';
  }
}

function sortVideoSubscriptions(content, cotentToSubscriptions) {
  if (!content.sortingByTags) {
    return cotentToSubscriptions;
  }

  const sortedCotentToSubscriptions = [];
  content.sortingByTags.forEach(tagToSort => {
    const subscription = cotentToSubscriptions.find(subscription => subscription.tags.includes(tagToSort));

    if (subscription) {
      sortedCotentToSubscriptions.push(subscription);
    }
  });

  let missedItems = [];
  if (sortedCotentToSubscriptions.length !== cotentToSubscriptions.length) {
    missedItems = cotentToSubscriptions.filter(item => {
      return !sortedCotentToSubscriptions.some(sortedItem => sortedItem.name === item.name);
    });

  }

  return [...sortedCotentToSubscriptions, ...missedItems];
}

function checkHasChanges(content) {
  let hasChanges = false;

  hasChanges = !content.records.every(record => {
    try {
      return parseFloat(record.DIFF) === 0;
    } catch(err) {
      return false;
    }
  });

  return hasChanges;
}

async function prepareRenderSettings(collection, subscription) {
  let renderSettings = {}
  try {
    renderSettings = await getRenderSettings();

    if (subscription && subscription.MANAGER_RENDER_SETTINGS) {
      for (const key in subscription.MANAGER_RENDER_SETTINGS) {
        renderSettings[key] = subscription.MANAGER_RENDER_SETTINGS[key];
      }
    }
    else if (collection === 'content-manager') {
      renderSettings.video_shouldRender = true;
      renderSettings.video_shouldSend_instagram = false,
      renderSettings.video_shouldSend_tiktok = false;
      renderSettings.video_shouldSend_youtube = false;
      renderSettings.image_shouldRender = true;
      renderSettings.image_shouldSend_telegram = false;
      renderSettings.image_shouldSend_stories = false;
      renderSettings.skipFilterByDay = true;
    }
  } catch (err) {
    if (!silenceMode) {
      console.log(err);
    }
  }

  return renderSettings;
}

userSubscriptionsProcess();