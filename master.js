
import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});
import { CronJob } from 'cron';
import { spawn } from 'node:child_process';

async function masterRun() {
  telegramBotJob();
  
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

  new CronJob(
    '*/1 * * * *',
    telegramSubscriptionsJobPL,
    async function() {
      console.log('==========================================');
      console.log('==== EXIT JOB: Telegram Subscriptions PL  ====');
      console.log('==========================================');
    },
    true,
    'Europe/Warsaw'
  );

  new CronJob(
    '*/1 * * * *',
    telegramSubscriptionsJobBY,
    async function() {
      console.log('==========================================');
      console.log('====  EXIT JOB: Telegram Subscriptions BY  ===');
      console.log('==========================================');
    },
    true,
    'Europe/Minsk'
  );



  new CronJob(
    '*/1 * * * *',
    videoSubscriptionsJobPL,
    async function() {
      console.log('==========================================');
      console.log('==== EXIT JOB: VIDEO Subscriptions PL  ====');
      console.log('==========================================');
    },
    true,
    'Europe/Warsaw'
  );

  new CronJob(
    '*/1 * * * *',
    videoSubscriptionsJobBY,
    async function() {
      console.log('==========================================');
      console.log('====  EXIT JOB: VIDEO Subscriptions BY  ===');
      console.log('==========================================');
    },
    true,
    'Europe/Minsk'
  );

  new CronJob(
    '0 */12 * * *',
    deleteMediaJob,
    async function() {
      console.log('==========================================');
      console.log('====  EXIT JOB: DELETE MEDIA  ===');
      console.log('==========================================');
    },
    true,
    'Europe/Warsaw'
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

  const userSubscriptionsProcessPL = spawn('node', ['./subscriptionsProcess', '--country', 'pl', '--collection', 'subscriptions-users']);

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

  const userSubscriptionsJobBY = spawn('node', ['./subscriptionsProcess', '--country', 'by', '--collection', 'subscriptions-users']);

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

async function telegramSubscriptionsJobPL() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: Telegram Subscriptions PL ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const telegramSubscriptionsProcessPL = spawn('node', ['./subscriptionsProcess', '--country', 'pl', '--collection', 'subscriptions-telegram']);

  telegramSubscriptionsProcessPL.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  telegramSubscriptionsProcessPL.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  telegramSubscriptionsProcessPL.on('close', (code) => {
    console.log(`user Subscriptions Process exited with code ${code}`);
    if (code === 0) {
      console.log('******************************************');
      console.log('***  EXIT JOB: Telegram Subscriptions PL  ****');
      console.log(`********** ${time} **********`);
      console.log('******************************************');
    }
  });
}

async function telegramSubscriptionsJobBY() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: Telegram Subscriptions BY ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const telegramSubscriptionsProcessBY = spawn('node', ['./subscriptionsProcess', '--country', 'by', '--collection', 'subscriptions-telegram']);

  telegramSubscriptionsProcessBY.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  telegramSubscriptionsProcessBY.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  telegramSubscriptionsProcessBY.on('close', (code) => {
    console.log(`user Subscriptions Process exited with code ${code}`);
    if (code === 0) {
      console.log('******************************************');
      console.log('***  EXIT JOB: Telegram Subscriptions BY  ****');
      console.log(`********** ${time} **********`);
      console.log('******************************************');
    }
  });
}

async function videoSubscriptionsJobPL() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: VIDEO Subscriptions PL ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const videoSubscriptionsProcessPL = spawn('node', ['./subscriptionsProcess', '--country', 'pl', '--collection', 'subscriptions-video']);

  videoSubscriptionsProcessPL.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  videoSubscriptionsProcessPL.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  videoSubscriptionsProcessPL.on('close', (code) => {
    console.log(`user Subscriptions Process exited with code ${code}`);
    if (code === 0) {
      console.log('******************************************');
      console.log('***  EXIT JOB: Telegram Subscriptions PL  ****');
      console.log(`********** ${time} **********`);
      console.log('******************************************');
    }
  });
}

async function videoSubscriptionsJobBY() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: VIDEO Subscriptions BY ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const videoSubscriptionsProcessBY = spawn('node', ['./subscriptionsProcess', '--country', 'by', '--collection', 'subscriptions-video']);

  videoSubscriptionsProcessBY.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  videoSubscriptionsProcessBY.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  videoSubscriptionsProcessBY.on('close', (code) => {
    console.log(`user Subscriptions Process exited with code ${code}`);
    if (code === 0) {
      console.log('******************************************');
      console.log('***  EXIT JOB: VIDEO Subscriptions BY  ****');
      console.log(`********** ${time} **********`);
      console.log('******************************************');
    }
  });
}

async function deleteMediaJob() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: DELETE MEDIA ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const deleteMediaProcess = spawn('node', ['./mediaManager']);

  deleteMediaProcess.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  deleteMediaProcess.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  deleteMediaProcess.on('close', (code) => {
    console.log(`Delete media Process exited with code ${code}`);
    if (code === 0) {
      console.log('******************************************');
      console.log('***  EXIT JOB: DELETE MEDIA  ****');
      console.log(`********** ${time} **********`);
      console.log('******************************************');
    }
  });
}

async function telegramBotJob() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: Telegram BOT ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const telegramBotJob = spawn('node', ['./telegramBot.js']);

  telegramBotJob.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  telegramBotJob.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  telegramBotJob.on('close', (code) => {
    console.log(`Telegram Bot Process exited with code ${code}`);
    if (code === 0) {
      console.log('******************************************');
      console.log('***  EXIT JOB: BOT  ****');
      console.log(`********** ${time} **********`);
      console.log('******************************************');
    }
  });
}

masterRun();
