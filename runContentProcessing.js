import { spawn } from 'node:child_process';
import {
  initBase,
  checkContentInQ
} from './base.js';

let isInProgress = false;

async function runner() {
  await initBase();

  setInterval(async () => {
    const countInQ = await checkContentInQ();
    if (!isInProgress && countInQ > 0) {
      console.log('=================');
      console.log('== Items In Q =', countInQ);
      isInProgress = true;
      runContentProcessing();
    }
  }, 1000);
}

function runContentProcessing() {
  const runContentProcess = spawn('node', ['./contentProcessing']);

  runContentProcess.stdout.on('data', (data) => {
    console.log(data.toString()?.trim());
  });

  runContentProcess.stderr.on('data', (data) => {
    console.error(data.toString()?.trim());
  });

  runContentProcess.on('close', () => {
    isInProgress = false;
  });
}

runner();