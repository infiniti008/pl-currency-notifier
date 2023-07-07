import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import axios from 'axios';
const videoRenderHost = process.env.videoRenderHost;

export function sendVideo(content) {
  
  return new Promise(async(resolve, reject) => {
    try {
      const response = await axios.post(videoRenderHost + '/api/send-video/youtube', {
        data: {
          content,
          isRemoveMedia: false
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