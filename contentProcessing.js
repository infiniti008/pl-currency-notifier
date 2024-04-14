import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import fs from 'fs';

import { getContentFromQ, initBase, closeConnection, deleteContentFromQ, addPostingFeed, getRenderSettings } from './base.js';
import generators from "./renders.js";
import { sendPhoto } from './sendPhoto.js';
import { sendYoutube, sendReelsToInstagram, sendTikTok, generateName, generateDescription } from './sendVideo.js';
import { sendStories } from './sendStories.js';

async function processing() {
  await initBase(true);

  const subscription = await getContentFromQ();

  if (subscription) {
    subscription.processes = {};
    const renderSettings = await getRenderSettings();
    const { 
      image_shouldRender = true,
      video_shouldRender = true
    } = renderSettings;

    let t = process.hrtime();

    console.log(`== RUN: CONTENT PROCESSING ==`);
    console.log(`== [ ${subscription.time} ] [ ${subscription.country} ] [ ${subscription.platform} ]`);

    if (video_shouldRender && subscription.platform === 'subscriptions-video') {
      await processVideo(subscription);
    } else if (image_shouldRender) {
      await processImages(subscription, renderSettings);
    }

    if (subscription.shouldPostToFeed) {
      await addPostingFeed(subscription);
    }

    await deleteContentFromQ(subscription.subscriptionId);

    t = process.hrtime(t);
    console.log(`== EXECUTION TIME: [ ${t[0]} ]`);
    console.log(`== END: CONTENT PROCESSING ==`);
  }

  await closeConnection(true);

  setTimeout(() => {}, 1000);
}

processing();

async function processImages(subscription, renderSettings) {
  const { 
    image_shouldSend_telegram = true,
    image_shouldSend_stories = true
  } = renderSettings;

  try {
    if (subscription.platform === 'subscriptions-users') {
      subscription.template = subscription.template ? subscription.template : renderSettings.telegram_user_render_template;
    }
    
    subscription.processes.renderImage = await generators.imageV2(subscription);
    const { completed: renderImageStatus = false, imagePath = null } = subscription.processes.renderImage;

    if (!renderImageStatus) {
      return;
    }

    subscription.imagePath = imagePath;

    if (image_shouldSend_telegram && subscription.platform === 'subscriptions-users') {
      subscription.processes.sendPhoto = await sendPhoto(getBufferedImage(imagePath), subscription.userId);
    }
    else if (image_shouldSend_telegram && subscription.platform === 'subscriptions-telegram') {
      subscription.processes.sendPhoto = await sendPhoto(getBufferedImage(imagePath), subscription.chanel, 'https://ko-fi.com/currency_notifications_app');
    }

    if (image_shouldSend_stories && subscription.platform === 'subscriptions-stories') {
      subscription.processes.sendPhoto = await sendStories(subscription);
    }
  } catch(err) {
    console.log(err);
  }
}

async function processVideo(subscription) {
  const { 
    shouldPostYoutube = true,
    shouldPostInstagram = true,
    shouldPostTiktok = true
  } = subscription;

  try {
    subscription.processes.renderVideo = await generators.video_v2(subscription);
    const { completed: renderVideoStatus = false, videoPath = null } = subscription.processes.renderVideo;

    if (videoPath) {
      subscription.videoPath = videoPath;

      generateName(subscription);
      generateDescription(subscription);

      if (shouldPostYoutube) {
        try {
          subscription.videoTitle = subscription.videoTitle_youtube;
          subscription.processes.sendYoutube = await sendYoutube(subscription);
        } catch(err) {  
          subscription.processes.sendYoutube = {
            completed: false,
            errors: [err?.message]
          };
        }
      }

      if (shouldPostInstagram) {
        try {
          subscription.videoTitle = subscription.videoTitle_youtube;
          subscription.processes.sendInstagramReels = await sendReelsToInstagram(subscription)
        } catch(err) {
          subscription.processes.sendInstagramReels = {
            completed: false,
            errors: [err?.message]
          };
        } 
      }

      if (shouldPostTiktok) {
        try {
          subscription.videoTitle = subscription.videoTitle_youtube;
          subscription.processes.sendTikTok = await sendTikTok(subscription);
        } catch(err) {
          subscription.processes.sendInstagramReels = {
            completed: false,
            errors: [err?.message]
          };
        } 
      }


      //     if (video_shouldSend_tiktok) {
      //       try {
      //         content.videoTitle = content.videoTitle_tiktok;
      //         // sendVidoArr[2] = await sendTikTok(content);
      //       } catch (err) {
      //         sendVidoArr[2] = {
      //           completed: false,
      //           errors: [err?.message]
      //         };
      //       }
      //     } else {
      //       sendVidoArr[2] = { completed: false };
      //     }
    }
  } catch(err) {
    console.log(err?.message);
  }
}

function getBufferedImage(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);

  return imageBuffer;
}