import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import fs from 'fs';

const env = process.env.environment || 'prod';
const mediaFolderPath = process.env['mediaFolderPath_' + env];

import { getContentFromQ, initBase, closeConnection, deleteContentFromQ } from './base.js';
import generators from "./renders.js";
import { sendPhoto } from './sendPhoto.js';
import { sendVideo, sendReelsToInstagram } from './sendVideo.js';
import { sendStories } from './sendStories.js';

async function processing() {
  // Init Base
  await initBase(true);

  // Get nextItem from Q
  const content = await getContentFromQ();

  // Process Content
  if (content) {
    console.time('   CONTENT_EXECUTION');
    console.log(`== RUN: CONTENT PROCESSING ==`);
    console.log(`   [ ${content.time} ] [ ${content.name} ] [ ${content.platform} ] ==`);

    let processContentResult = null;
    if (content.platform === 'subscriptions-video-all') {
      processContentResult = await processVideo(content);
    } else {
      processContentResult = await processImages(content);
    }

    // if (processContentResult) {
      await deleteContentFromQ(content._id.toString());
    // }
    console.timeEnd('   CONTENT_EXECUTION');
    console.log(`== END: CONTENT PROCESSING | ${content.platform} ==`);
  }

  // Close Base Connection
  await closeConnection(true);

  setTimeout(() => {}, 1000);
}

processing();

async function processImages(content) {
  return new Promise(async(resolve, reject) => {
    try {
      // -- Render Image
      const { imagePath = null, image = null } = await generators.base64(content, content.template);
      if (!imagePath && !image) {
        reject(false);
        return;
      }

      content.imagePath = imagePath;

      if (content.platform === 'subscriptions-users') {
        // Send Image to Chat
        await sendPhoto(getBufferedImage(image, imagePath), content.chatId);
      }
      else if (content.platform === 'subscriptions-telegram') {
        // Send Image to Chanel
        await sendPhoto(getBufferedImage(image, imagePath), content.chanel, content.tag);
      }
      else if (content.platform === 'subscriptions-telegram-promo') {
        // Send Promo to Chanel
        await sendPhoto(getBufferedImage(image, imagePath), content.chanel, 'https://ko-fi.com/currency_notifications_app');
      }
      else if (content.platform === 'subscriptions-stories') {
        // Send photo to Stories
        await sendStories(content);
      }
      
      resolve(true);
    } catch(err) {
      console.log(err);
      reject(false);
    }
  });
}

async function processVideo(content) {
  return new Promise(async(resolve, reject) => {
    try {
      // -- Render Image
      for(let i = 0; i < content.cotentToSubscriptions.length; i++) {
        const contentItem = content.cotentToSubscriptions[i];
        const { imagePath = null, image = null } = await generators.base64(contentItem, contentItem.template);
        if (!imagePath && !image) {
          reject(false);
          return;
        }

        contentItem.imagePath = imagePath;
      }

      const date = new Date().toLocaleDateString('ru-RU');

      content.fileName = date + '-' + content.time + '-' + content._id.toString()

      if (content.platform === 'subscriptions-video-all') {
        const { videoPath = null } = await generators.video(content);

        if (videoPath) {
          content.videoPath = videoPath;

          try {
            const [ 
              uploadVideoResult,
              uploadReelsResult 
            ] = await Promise.all([
              sendVideo(content),
              sendReelsToInstagram(content)
            ]);

            console.log('uploadReelsResult', uploadReelsResult);
            console.log('uploadVideoResult', uploadVideoResult);
          } catch(err) {
            console.log(err?.message);
          }
        }
      }
       
      resolve(true);
    } catch(err) {
      console.log(err?.message);
      reject(false);
    }
  });
}

function getBufferedImage(image, imagePath) {
  let imageBuffer = null;
  if (image) {
    imageBuffer = new Buffer.from(image, 'base64');
  }
  else if (imagePath) {
    imageBuffer = fs.readFileSync(mediaFolderPath + imagePath);
  }

  return imageBuffer;
}