import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import fs from 'fs';
import { MongoClient, ObjectId } from 'mongodb';

let client = null;
const isDev = process.env.environment === 'dev';

async function connect(isSilent) {
  try {
    client = new MongoClient(process.env.baseUrl);
    await client.connect();
    if (!isSilent) {
      console.log('Connected to base');
    }
  } catch(error) {
    console.error(error);
  }
}

export async function closeConnection(isSilent) {
  await client.close();
  if (!isSilent) {
    console.log('Connection to base closed');
  }
}

export async function initBase(isSilent) {
  await connect(isSilent);
}

export async function getKeys(country) {
  try {
    const configBaseName = process.env['configBaseName'];
    const keysCollection = await client.db(configBaseName).collection('keys_' + country);
    const keys = await keysCollection.find({ isDeprecated: { $ne: true} }).toArray();
    return keys;
  } catch(err) {
    console.log(err);
    return [];
  }
}

export async function getLastValue(baseName, keyObject) {
  try {
    const collection = await client.db(baseName).collection(keyObject.key);
    const val = await collection
      .find()
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    return {
      ...val[0],
      ...keyObject
    };
  } catch (err) {
    console.log(err);
  }
}

export async function getValueByTime(baseName, key, timestamp) {
  try {
    const collection = await client.db(baseName).collection(key);
    const val = await collection
      .findOne({
        timestamp: {$gte: timestamp}
      })

    return {
      ...val,
      key
    };
  } catch (err) {
    console.log(err);
  }
}

export async function getUserInfo(userId) {
  try {
    let user = await client.db('users').collection('u_' + userId);

    let val = await user.find().toArray();

    return val[0];
  } catch(err) {
    console.log(err);
  }
}

export async function getLastCurrencies(country) {
  try {
    const currencyBaseName = process.env[country + '_currencyBaseName'];
    const keyObjects = await getKeys(country);

    const requestsArray = [];

    keyObjects.forEach(key => {
      requestsArray.push(getLastValue(currencyBaseName, key));
    });

    const lastCurrencies = await Promise.all(requestsArray);
 
    return lastCurrencies;
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function getDiffCurrencies(country, keys, timestamp) {
  try {
    const currencyBaseName = process.env[country + '_currencyBaseName'];

    const requestsArray = [];

    keys.forEach(key => {
      requestsArray.push(getValueByTime(currencyBaseName, key, timestamp));
    });

    const diffCurrencies = await Promise.all(requestsArray);
 
    return diffCurrencies;
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function getAllSubscriptionsByTimeByCountry(time, country, subscriptionsCollection, subscriptionId) {
  try {
    const baseName = isDev ? 'currency_app_test' : 'currency_app';
    const subscriptions = await client.db(baseName).collection(subscriptionsCollection);

    if (subscriptionId) {
      const subscriptionById = await subscriptions.findOne({ _id: new ObjectId(subscriptionId) })

      return [subscriptionById];
    } else {
      const options = { 
        time: { $eq: time },
        country: { $eq: country }
      };

      const subscriptionsWithTime = await subscriptions.find(
        options,
        {}
      ).toArray();

      return subscriptionsWithTime;
    }
  } catch(err) {
    console.log(err);
    return null;
  }
}

export async function getAllSubscriptionsWithTimeByCountry(time, country, subscriptionsCollection, subscriptionId) {
  try {
    const baseName = isDev ? 'currency_app_test' : 'currency_app';
    const subscriptions = await client.db(baseName).collection(subscriptionsCollection);

    if (subscriptionId) {
      const subscriptionById = await subscriptions.findOne({ _id: new ObjectId(subscriptionId) })

      return [subscriptionById];
    } else {
      const options = { 
        times: {
          $elemMatch: { $eq: time }
        },
        country: { $eq: country }
      };

      if (subscriptionsCollection === 'content-manager') {
        delete options.times;
      }

      const subscriptionsWithTime = await subscriptions.find(
        options,
        {}
      ).toArray();

      return subscriptionsWithTime;
    }
  } catch(err) {
    console.log(err);
    return null;
  }
}

export async function addContentToQ(record) {
  try {
    const baseName = isDev ? 'currency_app_test' : 'currency_app';
    const dataCollection = await client.db(baseName).collection('processing-q');
    const result = await dataCollection.insertOne(record);
    return result;
  } catch(err) {
    console.log(err);
  }
}

export async function getContentFromQ() {
  try {
    const baseName = isDev ? 'currency_app_test' : 'currency_app';
    const dataCollection = await client.db(baseName).collection('processing-q');
    const content = await dataCollection.findOne();
    return content;
  } catch(err) {
    console.log(err);
  }
}

export async function deleteContentFromQ(id) {
  try {
    const baseName = isDev ? 'currency_app_test' : 'currency_app';
    const dataCollection = await client.db(baseName).collection('processing-q');
    const query = { 
      $or: [
        { subscriptionId: new ObjectId(id) },
        { subscriptionId: id }
      ]
    }
    const result = await dataCollection.deleteOne(query);
    return result;
  } catch(err) {
    console.log(err);
  }
}

export async function checkContentInQ() {
  try {
    const baseName = isDev ? 'currency_app_test' : 'currency_app';
    const qCount = await client.db(baseName).collection('processing-q').count();

    return qCount;
  } catch(err) {
    console.log(err);
  }
}

export async function getRenderSettings() {
  try {
    const baseName = isDev ? 'currency_app_test' : 'config_app';
    const dataCollection = await client.db(baseName).collection('render_settings');
    const content = await dataCollection.findOne();
    return content;
  } catch(err) {
    console.log(err);
  }
}

export async function checkContentInMangerQ() {
  try {
    const baseName = isDev ? 'currency_app_test' : 'currency_app';
    const qCount = await client.db(baseName).collection('content-manager').count();

    return qCount;
  } catch(err) {
    console.log(err);
  }
}

export async function getContentInMangerQ() {
  try {
    const baseName = isDev ? 'currency_app_test' : 'currency_app';
    const result = await client.db(baseName).collection('content-manager').findOne();

    return result;
  } catch(err) {
    console.log(err);
  }
}

export async function removeAllFromManagerQ() {
  try {
    const baseName = isDev ? 'currency_app_test' : 'currency_app';
    await client.db(baseName).collection('content-manager').drop();
  } catch(err) {
    console.log(err);
  }
}

export async function addPostingFeed(subscription) {
  try {
    const baseName = isDev ? 'currency_app_test' : 'currency_app';

    subscription.timestamp = new Date().valueOf();
    delete subscription._id;
    await client.db(baseName).collection('subscriptions-feed').insertOne(subscription);
  } catch(err) {
    console.log(err);
  }
}

