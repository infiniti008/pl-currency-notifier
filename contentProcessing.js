import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import fs from 'fs';

import { getContentFromQ, initBase, closeConnection, deleteContentFromQ } from './base.js';
import generators from "./renders.js";
import { sendPhoto } from './sendPhoto.js';
import { sendVideo } from './sendVideo.js';
import { sendStories } from './sendStories.js';

async function processing() {
  // Init Base
  await initBase(true);

  // Get nextItem from Q
  const content = await getContentFromQ();

  // Process Content
  if (content) {
    console.time('CONTENT_EXECUTION');
    console.log(`== RUN: CONTENT PROCESSING | ${content.platform} ==`);
    const processContentResult = await processImages(content);

    if (processContentResult) {
      await deleteContentFromQ(content._id.toString());
    }
    console.timeEnd('CONTENT_EXECUTION');
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
      // else if (content.platform === 'subscriptions-video') {
      //   // Send Promo to Chanel
      //   const { videoPath = null } = await generators.video(content);

      //   if (videoPath) {
      //     content.videoPath = videoPath;

      //     const uploadVideoResult = await sendVideo(content);
      //     console.log(uploadVideoResult)
      //   }
      // }
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

function getBufferedImage(image, imagePath) {
  let imageBuffer = null;
  if (image) {
    imageBuffer = new Buffer.from(image, 'base64');
  }
  else if (imagePath) {
    imageBuffer = fs.readFileSync(process.env.mediaFolderPath + imagePath);
  }

  return imageBuffer;
}