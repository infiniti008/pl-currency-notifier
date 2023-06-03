import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import FormData from 'form-data';
import axios from 'axios';

const botToken = process.env.botToken;

const TELEGRAM_API = "https://api.telegram.org/bot" + botToken;

export function sendPhoto(image, chatId) {
  return new Promise(async(resolve, reject) => {
    try {
      const caption = new Date().toLocaleString('ru-RU');
      const formData = new FormData();

      formData.append('chat_id', chatId);
      formData.append('photo', image, { filename : 'image.png' });
      formData.append('caption', caption);

      const response = await axios.post(`${TELEGRAM_API}/sendPhoto`, formData, {
        headers: formData.getHeaders(),
      });

      resolve(response.status);
    } catch (error) {
      console.error(error.message);
      reject(null);
    }
  });
}
