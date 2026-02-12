import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import fs from 'fs';
import { MongoClient, ObjectId } from 'mongodb';

export default class BaseClient {
  constructor(isSilent) {
    this.client = null;
    this.isDev = process.env.environment === 'dev';
    this.isSilent = isSilent;
    this.isConnecting = false;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  async connect() {
    !this.isSilent && console.log('Start connection to base');
    try {
      const options = {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        retryWrites: true,
        retryReads: true,
      };

      this.client = new MongoClient(process.env.baseUrl, options);
      await this.client.connect();

      // Setup event listeners
      this.client.on('serverHeartbeatFailed', (event) => {
        console.error('MongoDB heartbeat failed:', event);
      });

      this.client.on('topologyClosed', () => {
        console.error('MongoDB topology closed');
      });

      this.client.on('serverDescriptionChanged', (event) => {
        if (event.newDescription.type === 'Unknown') {
          console.warn('MongoDB server became unknown');
        }
      });

      !this.isSilent && console.log('Connected to base');
    } catch(error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  async ensureConnection(retryCount = 0) {
    if (this.isConnecting) {
      // Wait for ongoing connection attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.ensureConnection(retryCount);
    }

    try {
      // Check if client exists and is connected
      if (this.client && this.client.topology && this.client.topology.isConnected()) {
        return true;
      }

      if (retryCount >= this.maxRetries) {
        console.error(`Failed to connect to MongoDB after ${this.maxRetries} attempts`);
        return false;
      }

      this.isConnecting = true;
      console.log(`Attempting to reconnect to MongoDB (attempt ${retryCount + 1}/${this.maxRetries})...`);

      // Close existing client if any
      if (this.client) {
        try {
          await this.client.close();
        } catch (err) {
          // Ignore close errors
        }
        this.client = null;
      }

      // Reconnect
      await this.connect();
      this.isConnecting = false;
      return true;
    } catch (error) {
      this.isConnecting = false;
      console.error(`Reconnection attempt ${retryCount + 1} failed:`, error.message);
      
      if (retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.ensureConnection(retryCount + 1);
      }
      
      return false;
    }
  }

  async closeConnection() {
    setTimeout(async () => {
      await this.client.close();
      !this.isSilent && console.log('Connection to base closed');
    }, 10000);
  }

  async checkContentInQ() {
    try {
      if (!await this.ensureConnection()) {
        throw new Error('Cannot connect to MongoDB');
      }

      const baseName = this.isDev ? 'currency_app_test' : 'currency_app';
      const qCount = await this.client.db(baseName).collection('processing-q').count();
      !this.isSilent && console.log('Items In Q =', qCount);
  
      return qCount;
    } catch(err) {
      console.error('Error in checkContentInQ:', err.message);
      return 0;
    }
  }

  async getAllSubscriptionsByTimeByCountry(time, country, subscriptionsCollection, subscriptionId) {
    try {
      if (!await this.ensureConnection()) {
        throw new Error('Cannot connect to MongoDB');
      }

      const baseName = this.isDev ? 'currency_app_test' : 'currency_app';
      const subscriptions = this.client.db(baseName).collection(subscriptionsCollection);

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
      console.error('Error in getAllSubscriptionsByTimeByCountry:', err.message);
      return null;
    }
  }

  async addContentToQ(record) {
    try {
      if (!await this.ensureConnection()) {
        throw new Error('Cannot connect to MongoDB');
      }

      const baseName = this.isDev ? 'currency_app_test' : 'currency_app';
      const dataCollection = this.client.db(baseName).collection('processing-q');
      const result = await dataCollection.insertOne(record);
      return result;
    } catch(err) {
      console.error('Error in addContentToQ:', err.message);
      return null;
    }
  }

  async getContentFromQ() {
    try {
      if (!await this.ensureConnection()) {
        throw new Error('Cannot connect to MongoDB');
      }

      const baseName = this.isDev ? 'currency_app_test' : 'currency_app';
      const dataCollection = this.client.db(baseName).collection('processing-q');
      const content = await dataCollection.findOne();
      return content;
    } catch(err) {
      console.error('Error in getContentFromQ:', err.message);
      return null;
    }
  }

  async getRenderSettings() {
    try {
      if (!await this.ensureConnection()) {
        throw new Error('Cannot connect to MongoDB');
      }

      const baseName = this.isDev ? 'currency_app_test' : 'config_app';
      const dataCollection = this.client.db(baseName).collection('render_settings');
      const content = await dataCollection.findOne();
      return content;
    } catch(err) {
      console.error('Error in getRenderSettings:', err.message);
      return null;
    }
  }

  async deleteContentFromQ(id) {
    try {
      if (!await this.ensureConnection()) {
        throw new Error('Cannot connect to MongoDB');
      }

      const baseName = this.isDev ? 'currency_app_test' : 'currency_app';
      const dataCollection = this.client.db(baseName).collection('processing-q');
      const query = { 
        $or: [
          { subscriptionId: new ObjectId(id) },
          { subscriptionId: id }
        ]
      }
      const result = await dataCollection.deleteOne(query);
      return result;
    } catch(err) {
      console.error('Error in deleteContentFromQ:', err.message);
      return null;
    }
  }

  async addPostingFeed(subscription) {
    try {
      if (!await this.ensureConnection()) {
        throw new Error('Cannot connect to MongoDB');
      }

      const baseName = this.isDev ? 'currency_app_test' : 'currency_app';

      subscription.timestamp = new Date().valueOf();
      delete subscription._id;
      await this.client.db(baseName).collection('subscriptions-feed').insertOne(subscription);
    } catch(err) {
      console.error('Error in addPostingFeed:', err.message);
    }
  }
}

// export async function getKeys(country) {
//   try {
//     const configBaseName = process.env['configBaseName'];
//     const keysCollection = await client.db(configBaseName).collection('keys_' + country);
//     const keys = await keysCollection.find({ isDeprecated: { $ne: true} }).toArray();
//     return keys;
//   } catch(err) {
//     console.log(err);
//     return [];
//   }
// }

// export async function getLastValue(baseName, keyObject) {
//   try {
//     const collection = await client.db(baseName).collection(keyObject.key);
//     const val = await collection
//       .find()
//       .sort({ timestamp: -1 })
//       .limit(1)
//       .toArray();

//     return {
//       ...val[0],
//       ...keyObject
//     };
//   } catch (err) {
//     console.log(err);
//   }
// }

// export async function getValueByTime(baseName, key, timestamp) {
//   try {
//     const collection = await client.db(baseName).collection(key);
//     const val = await collection
//       .findOne({
//         timestamp: {$gte: timestamp}
//       })

//     return {
//       ...val,
//       key
//     };
//   } catch (err) {
//     console.log(err);
//   }
// }

// export async function getUserInfo(userId) {
//   try {
//     let user = await client.db('users').collection('u_' + userId);

//     let val = await user.find().toArray();

//     return val[0];
//   } catch(err) {
//     console.log(err);
//   }
// }

// export async function getLastCurrencies(country) {
//   try {
//     const currencyBaseName = process.env[country + '_currencyBaseName'];
//     const keyObjects = await getKeys(country);

//     const requestsArray = [];

//     keyObjects.forEach(key => {
//       requestsArray.push(getLastValue(currencyBaseName, key));
//     });

//     const lastCurrencies = await Promise.all(requestsArray);
 
//     return lastCurrencies;
//   } catch (err) {
//     console.log(err);
//     return null;
//   }
// }

// export async function getDiffCurrencies(country, keys, timestamp) {
//   try {
//     const currencyBaseName = process.env[country + '_currencyBaseName'];

//     const requestsArray = [];

//     keys.forEach(key => {
//       requestsArray.push(getValueByTime(currencyBaseName, key, timestamp));
//     });

//     const diffCurrencies = await Promise.all(requestsArray);
 
//     return diffCurrencies;
//   } catch (err) {
//     console.log(err);
//     return null;
//   }
// }

// export async function getAllSubscriptionsWithTimeByCountry(time, country, subscriptionsCollection, subscriptionId) {
//   try {
//     const baseName = isDev ? 'currency_app_test' : 'currency_app';
//     const subscriptions = await client.db(baseName).collection(subscriptionsCollection);

//     if (subscriptionId) {
//       const subscriptionById = await subscriptions.findOne({ _id: new ObjectId(subscriptionId) })

//       return [subscriptionById];
//     } else {
//       const options = { 
//         times: {
//           $elemMatch: { $eq: time }
//         },
//         country: { $eq: country }
//       };

//       if (subscriptionsCollection === 'content-manager') {
//         delete options.times;
//       }

//       const subscriptionsWithTime = await subscriptions.find(
//         options,
//         {}
//       ).toArray();

//       return subscriptionsWithTime;
//     }
//   } catch(err) {
//     console.log(err);
//     return null;
//   }
// }

// export async function checkContentInMangerQ() {
//   try {
//     const baseName = isDev ? 'currency_app_test' : 'currency_app';
//     const qCount = await client.db(baseName).collection('content-manager').count();

//     return qCount;
//   } catch(err) {
//     console.log(err);
//   }
// }

// export async function getContentInMangerQ() {
//   try {
//     const baseName = isDev ? 'currency_app_test' : 'currency_app';
//     const result = await client.db(baseName).collection('content-manager').findOne();

//     return result;
//   } catch(err) {
//     console.log(err);
//   }
// }

// export async function removeAllFromManagerQ() {
//   try {
//     const baseName = isDev ? 'currency_app_test' : 'currency_app';
//     await client.db(baseName).collection('content-manager').drop();
//   } catch(err) {
//     console.log(err);
//   }
// }


