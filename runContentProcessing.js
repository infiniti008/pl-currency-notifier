import { spawn } from 'node:child_process';
import BaseClient from './base.js';

let isInProgress = false;
const base = new BaseClient(true);

async function runner() {
  // Initial connection
  try {
    await base.connect();
    console.log('Runner connected to MongoDB');
  } catch (err) {
    console.error('Failed to connect initially:', err.message);
  }

  setInterval(async () => {
    try {
      const countInQ = await base.checkContentInQ();
      if (!isInProgress && countInQ > 0) {
        console.log('=================');
        console.log('== Items In Q =', countInQ);
        isInProgress = true;
        runContentProcessing();
      }
    } catch (err) {
      console.error('Error in runner:', err.message);
      // Connection will be retried by ensureConnection in checkContentInQ
    }
  }, 5000);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down runner...');
    if (base.client) {
      await base.client.close();
    }
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down runner...');
    if (base.client) {
      await base.client.close();
    }
    process.exit(0);
  });
}

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