import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { MongoClient, ObjectId } from 'mongodb';

/**
 * Централизованный модуль для работы с MongoDB
 * Использует singleton pattern для единого подключения
 */
class DatabaseManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.isDev = process.env.environment === 'dev';
    this.debugMode = process.env.MONGODB_DEBUG === 'true';
    this.heartbeatFailCount = 0;
    this.maxHeartbeatFails = 3;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;
  }

  log(...args) {
    if (this.debugMode) {
      console.log('[MongoDB]', ...args);
    }
  }

  /**
   * Получить имя базы данных в зависимости от окружения
   */
  getDbName(useConfig = false) {
    if (useConfig) {
      return this.isDev ? 'currency_app_test' : 'config_app';
    }
    return this.isDev ? 'currency_app_test' : 'currency_app';
  }

  /**
   * Установить подключение к MongoDB
   */
  async connect() {
    if (this.isConnecting) {
      this.log('Connection in progress, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.connect();
    }

    if (this.isConnected && this.client) {
      this.log('Already connected');
      return this.client;
    }

    this.isConnecting = true;
    this.log('Connecting to MongoDB...');

    try {
      const options = {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 60000,
        retryWrites: true,
        retryReads: true,
        heartbeatFrequencyMS: 10000,
      };

      this.client = new MongoClient(process.env.baseUrl, options);
      await this.client.connect();
      
      this.isConnected = true;
      this.isConnecting = false;
      this.heartbeatFailCount = 0;
      this.connectionRetries = 0;

      this.setupEventListeners();
      
      console.log('✓ Connected to MongoDB');
      return this.client;
    } catch (error) {
      this.isConnected = false;
      this.isConnecting = false;
      console.error('✗ MongoDB connection error:', error.message);
      throw error;
    }
  }

  /**
   * Настроить обработчики событий MongoDB
   */
  setupEventListeners() {
    if (!this.client) return;

    this.client.on('serverHeartbeatFailed', (event) => {
      this.heartbeatFailCount++;
      console.error(`MongoDB heartbeat failed (${this.heartbeatFailCount}/${this.maxHeartbeatFails}):`, {
        connectionId: event.connectionId,
        error: event.failure?.message
      });
      
      if (this.heartbeatFailCount >= this.maxHeartbeatFails) {
        console.error('Multiple heartbeat failures - connection unstable');
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
      console.error('MongoDB topology closed');
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
  }

  /**
   * Проверить и восстановить подключение при необходимости
   */
  async ensureConnection() {
    if (this.isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.ensureConnection();
    }

    // Быстрая проверка соединения
    if (this.isConnected && this.client?.topology) {
      const state = this.client.topology.s?.state;
      if (state === 'connected') {
        return true;
      }
      if (state === 'closed' || state === 'closing') {
        this.isConnected = false;
      }
    }

    // Переподключение если необходимо
    if (!this.client || !this.isConnected) {
      if (this.connectionRetries >= this.maxRetries) {
        throw new Error(`Failed to connect after ${this.maxRetries} attempts`);
      }

      console.log(`Reconnecting to MongoDB (${this.connectionRetries + 1}/${this.maxRetries})...`);
      
      // Закрыть существующее подключение
      if (this.client) {
        try {
          await this.client.close(true);
        } catch (err) {
          this.log('Error closing client (ignored):', err.message);
        }
        this.client = null;
      }

      // Задержка перед повторной попыткой
      if (this.connectionRetries > 0) {
        const delay = this.retryDelay * this.connectionRetries;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      this.connectionRetries++;
      await this.connect();
      return true;
    }

    return true;
  }

  /**
   * Закрыть подключение к базе данных
   */
  async close() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        this.client = null;
        console.log('✓ MongoDB connection closed');
      }
    } catch (err) {
      console.error('Error closing MongoDB connection:', err.message);
    }
  }

  /**
   * Получить коллекцию
   */
  getCollection(collectionName, useConfigDb = false) {
    if (!this.client) {
      throw new Error('Database not connected');
    }
    const dbName = this.getDbName(useConfigDb);
    return this.client.db(dbName).collection(collectionName);
  }
}

// Singleton instance
const dbManager = new DatabaseManager();

/**
 * Подключиться к базе данных
 */
export async function connectDatabase() {
  return await dbManager.connect();
}

/**
 * Закрыть подключение к базе данных
 */
export async function closeDatabase() {
  return await dbManager.close();
}

/**
 * Проверить количество элементов в очереди обработки
 */
export async function checkContentInQ() {
  try {
    await dbManager.ensureConnection();
    const collection = dbManager.getCollection('processing-q');
    const count = await collection.countDocuments();
    return count;
  } catch (err) {
    console.error('Error in checkContentInQ:', err.message);
    return 0;
  }
}

/**
 * Получить все подписки по времени и стране
 */
export async function getAllSubscriptionsByTimeByCountry(time, country, collectionName, subscriptionId = null) {
  try {
    await dbManager.ensureConnection();
    const collection = dbManager.getCollection(collectionName);

    if (subscriptionId) {
      const subscription = await collection.findOne({ _id: new ObjectId(subscriptionId) });
      return subscription ? [subscription] : [];
    }

    const subscriptions = await collection.find({
      time: { $eq: time },
      country: { $eq: country }
    }).toArray();

    return subscriptions;
  } catch (err) {
    console.error('Error in getAllSubscriptionsByTimeByCountry:', err.message);
    return [];
  }
}

/**
 * Добавить контент в очередь обработки
 */
export async function addContentToQ(record) {
  try {
    await dbManager.ensureConnection();
    const collection = dbManager.getCollection('processing-q');
    const result = await collection.insertOne(record);
    return result;
  } catch (err) {
    console.error('Error in addContentToQ:', err.message);
    return null;
  }
}

/**
 * Получить контент из очереди
 */
export async function getContentFromQ() {
  try {
    await dbManager.ensureConnection();
    const collection = dbManager.getCollection('processing-q');
    const content = await collection.findOne();
    return content;
  } catch (err) {
    console.error('Error in getContentFromQ:', err.message);
    return null;
  }
}

/**
 * Удалить контент из очереди по ID подписки
 */
export async function deleteContentFromQ(id) {
  try {
    await dbManager.ensureConnection();
    const collection = dbManager.getCollection('processing-q');
    
    const query = {
      $or: [
        { subscriptionId: new ObjectId(id) },
        { subscriptionId: id }
      ]
    };
    
    const result = await collection.deleteOne(query);
    return result;
  } catch (err) {
    console.error('Error in deleteContentFromQ:', err.message);
    return null;
  }
}

/**
 * Получить настройки рендеринга
 */
export async function getRenderSettings() {
  try {
    await dbManager.ensureConnection();
    const collection = dbManager.getCollection('render_settings', true);
    const settings = await collection.findOne();
    return settings;
  } catch (err) {
    console.error('Error in getRenderSettings:', err.message);
    return null;
  }
}

/**
 * Добавить запись в feed подписок
 */
export async function addPostingFeed(subscription) {
  try {
    await dbManager.ensureConnection();
    const collection = dbManager.getCollection('subscriptions-feed');
    
    const record = { ...subscription };
    record.timestamp = new Date().valueOf();
    delete record._id;
    
    await collection.insertOne(record);
    return true;
  } catch (err) {
    console.error('Error in addPostingFeed:', err.message);
    return false;
  }
}

/**
 * Graceful shutdown handler
 */
export async function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    console.log(`\n${signal} received, closing database connection...`);
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Экспортировать ObjectId для использования в других модулях
export { ObjectId };
