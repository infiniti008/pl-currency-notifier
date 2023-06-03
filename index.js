import fs from 'fs';
import generators from "./renders.js";
import { Command } from'commander';

const program = new Command();

program
  .option('-t, --type <type>', 'Render type')
  .option('-tp, --template <template>', 'Render template')
  .parse(process.argv);

const options = program.opts();

const data = JSON.parse(fs.readFileSync('./views/templates/test.hbs.json').toString());

async function run () {
  const count = 1;
  const timetaken = "Time taken by render images - " + count;
  console.time(timetaken);
  const arr = []

  for(let i = 0; i < count; i++) {
    arr.push(generators[options.type](data, options.template, false, options.template + i));
  }

  await Promise.all(arr);
  console.timeEnd(timetaken);
}

async function runPerOneRequest () {
  const count = 10;
  const timetaken = "Time taken by render images - " + count;
  console.time(timetaken);
  const contentArray = []

  for(let i = 0; i < count; i++) {
    contentArray.push(data);
  }

  await generators[options.type](contentArray, options.template, false, options.template);
  console.timeEnd(timetaken);
}

run();
// runPerOneRequest()

// node index.js -t html -tp pl-10-min
// node index.js -t image -tp pl-10-min
// node index.js -t base64 -tp pl-10-min