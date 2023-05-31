
import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});
import { CronJob } from 'cron';
import { spawn } from 'node:child_process';

async function masterRun() {
  new CronJob(
    '*/1 * * * *',
    userSubscriptionsJobPL,
    async function() {
      console.log('==========================================');
      console.log('==== EXIT JOB: User Subscriptions PL  ====');
      console.log('==========================================');
    },
    true,
    'Europe/Warsaw'
  );

  new CronJob(
    '*/1 * * * *',
    userSubscriptionsJobBY,
    async function() {
      console.log('==========================================');
      console.log('====  EXIT JOB: User Subscriptions BY  ===');
      console.log('==========================================');
    },
    true,
    'Europe/Minsk'
  );

  console.log('==========================================');
  console.log('====== APPLICATION HAS BEEN STARTED ======');
  console.log('==========================================');
}

async function userSubscriptionsJobPL() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: User Subscriptions PL ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const userSubscriptionsProcessPL = spawn('node', ['./userSubscriptionsProcess', '--country', 'pl']);

  userSubscriptionsProcessPL.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  userSubscriptionsProcessPL.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  userSubscriptionsProcessPL.on('close', (code) => {
    console.log(`user Subscriptions Process exited with code ${code}`);
    if (code === 0) {
      console.log('******************************************');
      console.log('***  EXIT JOB: User Subscriptions PL  ****');
      console.log(`********** ${time} **********`);
      console.log('******************************************');
    }
  });
}

async function userSubscriptionsJobBY() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: User Subscriptions BY ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const userSubscriptionsJobBY = spawn('node', ['./userSubscriptionsProcess', '--country', 'by']);

  userSubscriptionsJobBY.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  userSubscriptionsJobBY.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  userSubscriptionsJobBY.on('close', (code) => {
    console.log(`user Subscriptions Process exited with code ${code}`);
    if (code === 0) {
      console.log('******************************************');
      console.log('***  EXIT JOB: User Subscriptions BY  ****');
      console.log(`********** ${time} **********`);
      console.log('******************************************');
    }
  });
}

masterRun();
 