/**
 * @deprecated В production используется processingWorker.js
 * 
 * STANDALONE ПРОЦЕСС - только для тестирования!
 * 
 * Production использование:
 * - master.js -> processingWorker.js (worker thread, общее подключение к БД)
 * 
 * Этот файл используется ТОЛЬКО для:
 * - Тестирования runner логики вне master процесса
 * - Отладки обработки очереди
 * 
 * ВНИМАНИЕ: Создает свое подключение к БД и spawns процессы (не оптимально)
 */

import { spawn } from 'node:child_process';
import { connectDatabase, checkContentInQ, setupGracefulShutdown } from './database.js';

let isInProgress = false;

async function runner() {
  // Initial connection
  try {
    await connectDatabase();
    console.log('✓ Runner ready and connected to MongoDB');
  } catch (err) {
    console.error('Failed to connect initially:', err.message);
  }

  setInterval(async () => {
    try {
      const countInQ = await checkContentInQ();
      if (!isInProgress && countInQ > 0) {
        console.log('=================');
        console.log('== Items In Q =', countInQ);
        isInProgress = true;
        runContentProcessing();
      }
    } catch (err) {
      console.error('Error in runner:', err.message);
      // Connection will be retried automatically by ensureConnection
    }
  }, 5000);
}

// Настроить graceful shutdown
setupGracefulShutdown();

function runContentProcessing() {
  const runContentProcess = spawn('node', ['./contentProcessing']);

  runContentProcess.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  runContentProcess.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  runContentProcess.on('close', () => {
    isInProgress = false;
  });
}

runner();