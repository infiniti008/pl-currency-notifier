import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import axios from 'axios';

const environment = process.env.environment || 'prod';
const imageRenderHost = process.env['imageRenderHost_' + environment];
const videoRenderHost = process.env['videoRenderHost_' + environment];

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
      console.error(error?.message);
      reject({});
    }
  });
}

export function sendReelsToInstagram(content) {
  return new Promise(async(resolve, reject) => {
    try {
      content.videoTitle = content?.videoTitle?.replace('#shorts', '#reels');
      const response = await axios.post(imageRenderHost + '/api/send-reels', {
        data: {
          content
        },
        headers: {
          'Content-Type': 'application/json'
        },
      });

      resolve(response.data);
    } catch (error) {
      console.error(error?.message);
      reject({});
    }
  });
}