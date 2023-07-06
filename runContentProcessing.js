import { spawn } from 'node:child_process';

let isInProgress = false;

setInterval(() => {
  if (!isInProgress) {
    isInProgress = true;
    runContentProcessing();
  }
}, 1000);

function runContentProcessing() {
  console.log('-');
  const runContentProcess = spawn('node', ['./contentProcessing']);

  runContentProcess.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  runContentProcess.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  runContentProcess.on('close', (code) => {
    isInProgress = false;
  });
}