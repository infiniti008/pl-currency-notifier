import { spawn } from 'node:child_process';
import BaseClient from './base.js';

let isInProgress = false;

async function runner() {
  setInterval(async () => {
    const base = new BaseClient(true);
    try {
      await base.connect();

      const countInQ = await base.checkContentInQ();
      if (!isInProgress && countInQ > 0) {
        console.log('=================');
        console.log('== Items In Q =', countInQ);
        isInProgress = true;
        runContentProcessing();
      }

      await base.closeConnection();
    } catch (err) {
      console.error('Error in runner:', err.message);
      // Connection will be retried on next interval
    }
  }, 5000);
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