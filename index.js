import generators from "./renders.js";
import { Command } from'commander';

const program = new Command();

program
  .option('-t, --type <type>', 'Render type')
  .option('-tp, --template <template>', 'Render template')
  .parse(process.argv);

const options = program.opts();

const data = {
  banks: [
    {
      BANK: 'PKO',
      CURRENCY: 'USD',
      OPERATION: 'BUY',
      DAY_START: '4.11',
      DIFF: '+0.01',
      NOW: '4.12',
      DIFF_STYLE: 'diff-up'
    },
    {
      BANK: 'PKO',
      CURRENCY: 'USD',
      OPERATION: 'SELL',
      DAY_START: '4.21',
      DIFF: '+0.01',
      NOW: '4.22',
      DIFF_STYLE: 'diff-down'
    }
  ],
  DATE: new Date().toLocaleDateString(),
  TIME: new Date().toLocaleTimeString()
};

generators[options.type](data, options.template);

// node index.js -t html -tp pl-10-min
// node index.js -t image -tp pl-10-min
// node index.js -t base64 -tp pl-10-min