import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

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

export async function getAllSubscriptionsWithTimeByCountry(time, country, subscriptionsCollection, subscriptionId) {
  try {
    const subscriptions = await client.db('currency_app').collection(subscriptionsCollection);

    if (subscriptionId) {
      const subscriptionById = await subscriptions.findOne({ _id: new ObjectId(subscriptionId) })

      return [subscriptionById];
    } else {
      const subscriptionsWithTime = await subscriptions.find(
        { 
          times: {
            $elemMatch: { $eq: time }
          },
          country: { $eq: country }
        },
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
    const collectionName = isDev ? 'test-processing-q' : 'processing-q';
    const dataCollection = await client.db('currency_app').collection(collectionName);
    const result = await dataCollection.insertOne(record);
    return result;
  } catch(err) {
    console.log(err);
  }
}

export async function getContentFromQ() {
  try {
    const collectionName = isDev ? 'test-processing-q' : 'processing-q';
    const dataCollection = await client.db('currency_app').collection(collectionName);
    const content = await dataCollection.findOne();
    return content;
  } catch(err) {
    console.log(err);
  }
}

export async function deleteContentFromQ(id) {
  try {
    const collectionName = isDev ? 'test-processing-q' : 'processing-q';
    const dataCollection = await client.db('currency_app').collection(collectionName);
    const result = await dataCollection.deleteOne({ _id: new ObjectId(id) });
    return result;
  } catch(err) {
    console.log(err);
  }
}

export async function checkContentInQ() {
  try {
    const collectionName = isDev ? 'test-processing-q' : 'processing-q';
    const qCount = await client.db('currency_app').collection(collectionName).count();

    return qCount;
  } catch(err) {
    console.log(err);
  }
}