
import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});
import { CronJob } from 'cron';
import { spawn } from 'node:child_process';

async function masterRun() {
  telegramBotJob();
  processingQJob();

  new CronJob(
    '*/1 * * * *',
    async function() {
      userSubscriptionsJobPL();
      userSubscriptionsJobBY();
    },
    async function() {
      console.log('==========================================');
      console.log('===== EXIT JOB: User Subscriptions  ======');
      console.log('==========================================');
    },
    true,
    'Europe/Warsaw'
  );
  
  new CronJob(
    '*/1 * * * *',
    async function() {
      telegramSubscriptionsJobPL();
      telegramSubscriptionsJobBY();

      videoSubscriptionsJobPL();
      videoSubscriptionsJobBY();

      storiesSubscriptionsJobPL();
      storiesSubscriptionsJobBY();
    },
    async function() {
      console.log('==========================================');
      console.log('==== EXIT JOB: Chanel Subscriptions  ====');
      console.log('==========================================');
    },
    true,
    'Europe/Warsaw'
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

async function storiesSubscriptionsJobPL() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: STORIES Subscriptions PL ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const storiesSubscriptionsProcessPL = spawn('node', ['./subscriptionsProcess', '--country', 'pl', '--collection', 'subscriptions-stories']);

  storiesSubscriptionsProcessPL.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  storiesSubscriptionsProcessPL.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  storiesSubscriptionsProcessPL.on('close', (code) => {
    console.log(`Stories Subscriptions Process exited with code ${code}`);
    if (code === 0) {
      console.log('******************************************');
      console.log('***  EXIT JOB: STORIES Subscriptions PL  ****');
      console.log(`********** ${time} **********`);
      console.log('******************************************');
    }
  });
}

async function storiesSubscriptionsJobBY() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: STORIES Subscriptions BY ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const storiesSubscriptionsProcessBY = spawn('node', ['./subscriptionsProcess', '--country', 'by', '--collection', 'subscriptions-stories']);

  storiesSubscriptionsProcessBY.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  storiesSubscriptionsProcessBY.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  storiesSubscriptionsProcessBY.on('close', (code) => {
    console.log(`Stories Subscriptions Process exited with code ${code}`);
    if (code === 0) {
      console.log('******************************************');
      console.log('***  EXIT JOB: STORIES Subscriptions BY  ****');
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

async function processingQJob() {
  const time = new Date().toLocaleString();
  console.log('==========================================');
  console.log('==== START JOB: PROCESSING CONTENT FROM Q ====');
  console.log(`========== ${time} ==========`);
  console.log('==========================================');

  const processingQProcess = spawn('node', ['./runContentProcessing.js']);

  processingQProcess.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  processingQProcess.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  processingQProcess.on('close', (code) => {
    console.log('******************************************');
    console.log(`PROCESSING CONTENT FROM Q Process exited with code ${code}`);
    console.log('***  EXIT JOB: PROCESSING CONTENT FROM Q  ****');
    console.log(`********** ${time} **********`);
    console.log('******************************************');
  });
}

masterRun();
