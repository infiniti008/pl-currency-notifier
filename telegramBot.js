import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});
import TelegramBot from 'node-telegram-bot-api';

const token = process.env.botToken;

const bot = new TelegramBot(token, {polling: true});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const fileOptions = {
    filename: 'customfilename',
    contentType: 'image/png',
  };

  bot.sendPhoto(chatId, './welcomeBot.png', {}, fileOptions);
  bot.sendMessage(chatId, 'Welcome to the Bot! Please use Menu button to configure subscription or look at last exchange rates.');
});

bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, 'Have a good day');
});

// Listen for any kind of message. There are different kinds of
// messages.
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  // send a message to the chat acknowledging receipt of their message
  if (msg.text !== '/start' && msg.text !== '/stop')
  bot.sendMessage(chatId, 'Please use Menu button');
});