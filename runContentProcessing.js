import { spawn } from 'node:child_process';
import {
  initBase,
  closeConnection,
  checkContentInQ,
  checkContentInMangerQ,
  getContentInMangerQ
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

    const countInManagerQ = await checkContentInMangerQ();
    if (!isInProgress && countInManagerQ > 0) {
      console.log('=================');
      console.log('== Items In Manager Q =', countInManagerQ);
      isInProgress = true;
      runContentManagerProcess();
    }
  }, 1000);

  // await closeConnection();
}

function runContentProcessing() {
  const runContentProcess = spawn('node', ['./contentProcessing']);

  runContentProcess.stdout.on('data', (data) => {
    console.log(data.toString()?.trim());
  });

  runContentProcess.stderr.on('data', (data) => {
    console.error(data.toString()?.trim());
  });

  runContentProcess.on('close', (code) => {
    isInProgress = false;
  });
}

async function runContentManagerProcess() {
  const subscription = await getContentInMangerQ();

  const runContentManagerProcess = spawn('node', [
    './subscriptionsProcess',
    '--collection', 'content-manager',
    '--datetime', subscription.DATE_TO_GET_NOW,
    '--country', subscription.country
  ]);

  runContentManagerProcess.stdout.on('data', (data) => {
    console.log(data.toString()?.trim());
  });

  runContentManagerProcess.stderr.on('data', (data) => {
    console.error(data.toString()?.trim());
  });

  runContentManagerProcess.on('close', (code) => {
    isInProgress = false;
  });
}

runner();