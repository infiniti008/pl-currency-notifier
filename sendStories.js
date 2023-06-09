import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import axios from 'axios';

const environment = process.env.environment || 'prod';
const imageRenderHost = process.env['imageRenderHost_' + environment];

export function sendStories(content) {
  return new Promise(async(resolve, reject) => {
    try {
      const response = await axios.post(imageRenderHost + '/api/send-stories', {
        data: {
          content
        },
        headers: {
          'Content-Type': 'application/json'
        },
      });

      resolve(response.data);
    } catch (error) {
      console.error(error.message);
      reject(null);
    }
  });
}