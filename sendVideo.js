import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import { DateTime } from 'luxon';
import axios from 'axios';
import uploadVideo from "./youtube/index.js";

const environment = process.env.environment || 'prod';
const imageRenderHost = process.env['imageRenderHost_' + environment];
const videoRenderHost = process.env['videoRenderHost_' + environment];

export function sendVideo(content) {
  return new Promise(async(resolve) => {
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
      resolve({ completed: false, errors: [error?.message] });
    }
  });
}

export async function sendReelsToInstagram(subscription) {
  try {
    const response = await axios.post(imageRenderHost + '/api/send-reels', {
      data: {
        subscription
      },
      headers: {
        'Content-Type': 'application/json'
      },
    });

    return response.data;
  } catch (error) {
    console.error(error?.message);
    return { completed: false, error: error.message };
  }
}

export function sendTikTok(subscription) {
  return new Promise(async(resolve, reject) => {
    try {
      const response = await axios.post(imageRenderHost + '/api/send-tiktok', {
        data: {
          subscription
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

export async function sendYoutube(subscription) {
  try {
    const result = await uploadVideo(subscription.country, subscription.videoTitle, subscription.videoDescription, subscription.videoPath);

    return result;
  } catch (error) {
    console.error(error.message);
    return { completed: false, error: error.message };
  }
}

export function generateName(subscription) {
  try {
    let videoTitle = '';
    const dateTime = DateTime.now().setZone(subscription.country === 'by' ? 'Europe/Minsk' : 'Europe/Warsaw').toFormat('dd.MM.yyyy HH:mm');
    videoTitle = subscription.titleTextTemplate;
    videoTitle = videoTitle.replace('{{DATE_TIME}}', dateTime);
    
    subscription.videoTitle_youtube = videoTitle.replace('{{TITLE_TAGS}}', subscription.titleTags_youtube);
    subscription.videoTitle_instagram = videoTitle.replace('{{TITLE_TAGS}}', subscription.titleTags_instagram);
    subscription.videoTitle_tiktok = videoTitle.replace('{{TITLE_TAGS}}', subscription.titleTags_tiktok);
  } catch (err) {
    console.log(err);
    subscription.videoTitle_youtube = 'Name';
    subscription.videoTitle_instagram = 'Name';
    subscription.videoTitle_tiktok = 'Name';
  }
}

export function generateDescription(subscription) {
  try {
    const allTags = subscription.tags + ' ' + subscription.frames.map(subscription => subscription?.tags).join(' ');
    const videoDescription = allTags + '\r\n\r\n' + subscription.description.join('\r\n');

    subscription.videoDescription = videoDescription;
  } catch (err) {
    console.log(err);
    subscription.videoDescription = 'Description';
  }
}