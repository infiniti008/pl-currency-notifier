import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import fs from 'fs';

const env = process.env.environment || 'prod';
const mediaFolderPath = process.env['mediaFolderPath_' + env];

import { getContentFromQ, initBase, closeConnection, deleteContentFromQ, addPostingFeed, getRenderSettings } from './base.js';
import generators from "./renders.js";
import { sendPhoto } from './sendPhoto.js';
import { sendVideo, sendReelsToInstagram, sendTikTok } from './sendVideo.js';
import { sendStories } from './sendStories.js';

async function processing() {
  // Init Base
  await initBase(true);

  // Get nextItem from Q
  const subscription = await getContentFromQ();

  // Process subscription
  if (subscription) {
    subscription.processes = {};
    const renderSettings = await getRenderSettings();
    const { 
      image_shouldRender = true,
      video_shouldRender = true
    } = renderSettings;

    let t = process.hrtime();

    console.log(`== RUN: CONTENT PROCESSING ==`);
    console.log(`== [ ${subscription.time} ] [ ${subscription.name} ] [ ${subscription.platform} ]`);

    if (video_shouldRender && subscription.platform === 'subscriptions-video-all') {
      await processVideo(subscription, renderSettings);
    } else if (image_shouldRender) {
      await processImages(subscription, renderSettings);
    }

    if (subscription.shouldPostToFeed) {
      await addPostingFeed(subscription);
    }

    await deleteContentFromQ(subscription.id);

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

async function processVideo(content, renderSettings) {
  const { 
    video_shouldSend_youtube = true,
    video_shouldSend_instagram = true,
    video_shouldSend_tiktok = true
  } = renderSettings;

  return new Promise(async(resolve, reject) => {
    try {
      const date = new Date().toLocaleDateString('ru-RU');

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

      // Render Title Image
      if (content.titleImageTemplate && content.titleImagePathVariable) {
        try {
          const titleImageTemplatePath = mediaFolderPath + renderSettings[content.titleImagePathVariable];
          const titleImageTemplateBase64 = fs.readFileSync(titleImageTemplatePath).toString('base64');
          const TITLE_ORIGINAL_IMAGE = titleImageTemplateBase64;

          content.fileName = date + '-' + content.time + '-title-' + content.country;
          content.TITLE_DATE = date + ' ' + content.time;

          const { imagePath = null, image = null } = await generators.base64(
            content,
            content.titleImageTemplate,
            false,
            null,
            [
              {
                rule: "{{ TITLE_ORIGINAL_IMAGE }}",
                string: TITLE_ORIGINAL_IMAGE
              }
            ]
          );

          content.titleImagePath = imagePath;
        } catch (err) {
          console.log(err);
        }
      }

      content.fileName = date + '-' + content.time + '-' + content._id.toString()

      if (content.platform === 'subscriptions-video-all') {
        const { videoPath = null } = await generators.video(content);

        if (videoPath) {
          content.videoPath = videoPath;

          try {
            const sendVidoArr = [];
            if (video_shouldSend_youtube) {
              try {
                content.videoTitle = content.videoTitle_youtube;
                // sendVidoArr[0] = await sendVideo(content);
              } catch (err) {
                sendVidoArr[0] = {
                  completed: false,
                  errors: [err?.message]
                };
              }
            } else {
              sendVidoArr[0] = {
                completed: false
              };
            }

            if (video_shouldSend_instagram) {
              try {
                content.videoTitle = content.videoTitle_instagram;
                // sendVidoArr[1] = await sendReelsToInstagram(content);
              } catch (err) {
                sendVidoArr[1] = {
                  completed: false,
                  errors: [err?.message]
                };
              }
            } else {
              sendVidoArr[1] = { completed: false };
            }

            if (video_shouldSend_tiktok) {
              try {
                content.videoTitle = content.videoTitle_tiktok;
                // sendVidoArr[2] = await sendTikTok(content);
              } catch (err) {
                sendVidoArr[2] = {
                  completed: false,
                  errors: [err?.message]
                };
              }
            } else {
              sendVidoArr[2] = { completed: false };
            }
            
            const [ 
              uploadVideoResult,
              uploadReelsResult,
              uploadTiktokResult 
            ] = sendVidoArr;

            console.log('uploadReelsResult', uploadReelsResult);
            console.log('uploadVideoResult', uploadVideoResult);
            console.log('uploadTiktokResult', uploadTiktokResult);
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

function getBufferedImage(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);

  return imageBuffer;
}