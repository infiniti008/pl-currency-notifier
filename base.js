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
    this.isConnected = false;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
    this.heartbeatFailCount = 0;
    this.maxHeartbeatFails = 3;
    this.debugMode = process.env.MONGODB_DEBUG === 'true';
  }

  log(...args) {
    if (this.debugMode) {
      console.log('[MongoDB Debug]', ...args);
    }
  }

  async connect() {
    !this.isSilent && console.log('Start connection to base');
    this.log('Connecting with URL:', process.env.baseUrl?.replace(/\/\/.*@/, '//<credentials>@'));
    
    try {
      const options = {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        retryWrites: true,
        retryReads: true,
        heartbeatFrequencyMS: 10000,
      };

      this.client = new MongoClient(process.env.baseUrl, options);
      await this.client.connect();
      this.isConnected = true;
      this.heartbeatFailCount = 0;
      this.log('MongoDB client created and connected');

      // Setup event listeners
      this.client.on('serverHeartbeatFailed', (event) => {
        this.heartbeatFailCount++;
        console.error(`MongoDB heartbeat failed (${this.heartbeatFailCount}/${this.maxHeartbeatFails}):`, {
          connectionId: event.connectionId,
          duration: event.duration,
          error: event.failure?.message
        });
        
        // Mark as disconnected after multiple failures
        if (this.heartbeatFailCount >= this.maxHeartbeatFails) {
          console.error('Multiple heartbeat failures detected, marking connection as failed');
          this.isConnected = false;
        }
      });

      this.client.on('serverHeartbeatSucceeded', () => {
        if (this.heartbeatFailCount > 0) {
          console.log('MongoDB heartbeat recovered');
          this.heartbeatFailCount = 0;
          this.isConnected = true;
        }
      });

      this.client.on('topologyClosed', () => {
        console.error('MongoDB topology closed - connection lost');
        this.isConnected = false;
        this.client = null;
      });

      this.client.on('serverDescriptionChanged', (event) => {
        if (event.newDescription.type === 'Unknown') {
          console.warn('MongoDB server became unknown');
          this.isConnected = false;
        } else if (event.newDescription.type !== 'Unknown' && event.previousDescription.type === 'Unknown') {
          console.log('MongoDB server recovered');
          this.isConnected = true;
          this.heartbeatFailCount = 0;
        }
      });

      this.client.on('error', (error) => {
        console.error('MongoDB client error:', error.message);
        this.isConnected = false;
      });

      !this.isSilent && console.log('Connected to base');
    } catch(error) {
      this.isConnected = false;
      console.error('MongoDB connection error:', error.message);
      throw error;
    }
  }

  async ensureConnection(retryCount = 0) {
    // Wait for ongoing connection attempt
    if (this.isConnecting) {
      this.log('Connection attempt in progress, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.ensureConnection(retryCount);
    }

    try {
      // Quick check - if we think we're connected, trust it (fast path)
      if (this.isConnected && this.client && this.client.topology) {
        const state = this.client.topology.s?.state;
        
        // If topology is connected, return immediately (no ping needed)
        if (state === 'connected') {
          this.log('Connection already established (fast path)');
          return true;
        }
        
        // If state is closing/closed, we need to reconnect
        if (state === 'closed' || state === 'closing') {
          this.log('Topology closed, need to reconnect');
          this.isConnected = false;
        }
      }

      // If we get here and there's no client, or client is not connected, reconnect
      if (!this.client || !this.isConnected) {
        // Need to reconnect
        if (retryCount >= this.maxRetries) {
          console.error(`Failed to connect to MongoDB after ${this.maxRetries} attempts`);
          return false;
        }

      this.isConnecting = true;
      const attemptNum = retryCount + 1;
      console.log(`Attempting to reconnect to MongoDB (${attemptNum}/${this.maxRetries})...`);

      // Close existing client if any
      if (this.client) {
        this.log('Closing existing client...');
        try {
          await this.client.close(true); // Force close
        } catch (err) {
          // Ignore close errors
          this.log('Error closing client (ignored):', err.message);
        }
        this.client = null;
      }

      // Wait before retry (except first attempt)
      if (retryCount > 0) {
        const delay = this.retryDelay * retryCount; // Exponential backoff
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

        // Reconnect
        this.log('Initiating new connection...');
        await this.connect();
        this.isConnecting = false;
        console.log('Reconnection successful');
        return true;
      }
      
      // We have a connection that appears valid
      return true;
    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;
      console.error(`Reconnection attempt ${retryCount + 1} failed:`, error.message);
      this.log('Full error:', error);
      
      if (retryCount < this.maxRetries - 1) {
        return this.ensureConnection(retryCount + 1);
      }
      
      return false;
    }
  }

  async closeConnection() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        this.client = null;
        !this.isSilent && console.log('Connection to base closed');
      }
    } catch (err) {
      console.error('Error closing connection:', err.message);
    }
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


