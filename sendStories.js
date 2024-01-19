import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import axios from 'axios';

const environment = process.env.environment || 'prod';
const imageRenderHost = process.env['imageRenderHost_' + environment];

export function sendStories(subscription) {
  return new Promise(async(resolve) => {
    try {
      const response = await axios.post(imageRenderHost + '/api/send-stories', {
        data: {
          subscription
        },
        headers: {
          'Content-Type': 'application/json'
        },
      });

      resolve(response.data);
    } catch (error) {
      console.error(error.message);
      resolve({ completed: false, error: error.message });
    }
  });
}