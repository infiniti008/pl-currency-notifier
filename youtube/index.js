// YouTube API video uploader using JavaScript/Node.js
// You can find the full visual guide at: https://www.youtube.com/watch?v=gncPwSEzq1s
// You can find the brief written guide at: https://quanticdev.com/articles/automating-my-youtube-uploads-using-nodejs
//
// Upload code is adapted from: https://developers.google.com/youtube/v3/quickstart/nodejs
import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import fs from 'fs';
import readline from 'readline';
import {google} from 'googleapis';
const OAuth2 = google.auth.OAuth2;

// video category IDs for YouTube:
const categoryIds = {
  Entertainment: 24,
  Education: 27,
  ScienceTechnology: 28
}

// If modifying these scopes, delete your previously saved credentials in client_oauth_token.json
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
const TOKEN_PATH_TEMPLATE = './youtube/{{COUNTRY}}_client_oauth_token.json';
const TOKEN_NAME_TEMPLATE = '{{COUNTRY}}_client_oauth_token';

export default async function uploadVideo (country, title, description, videoFilePath) {
  try {
    const TOKEN_PATH = TOKEN_PATH_TEMPLATE.replace('{{COUNTRY}}', country);
    const TOKEN_NAME = TOKEN_NAME_TEMPLATE.replace('{{COUNTRY}}', country);
    const client_secret = JSON.parse(process.env.client_secret);


    const auth = await authorize(client_secret, TOKEN_PATH, TOKEN_NAME);
    if (!auth){
      return { completed: false };
    }
    
    return await performUploadVideo(auth, title, description, videoFilePath);
  } catch(err) {
    console.log(err);
    return { completed: false };
  }
}


async function performUploadVideo(auth, title, description, videoFilePath) {
  try {
    const service = google.youtube('v3');

    const response = await service.videos.insert({
      auth: auth,
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title,
          description,
          tags: 'currency, rates',
          categoryId: categoryIds.Entertainment,
          defaultLanguage: 'en',
          defaultAudioLanguage: 'en'
        },
        status: {
          privacyStatus: process.env.youtubeVideoPrivacyStatus || 'private',
          selfDeclaredMadeForKids: false,
          madeForKids: false
        },
      },
      media: {
        body: fs.createReadStream(videoFilePath),
      },
    });

    return { completed: true, data: response?.data };
  } catch(err) {
    console.log(err.response?.data);
    return { completed: false, data: err.response?.data };
  }
}

async function authorize(credentials, TOKEN_PATH, TOKEN_NAME) {
  try {
    const clientSecret = credentials.client_secret;
    const clientId = credentials.client_id;
    const redirectUrl = credentials.redirect_uris?.[0];
    const oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);

    let token = null;

    try {
      token = fs.readFileSync(TOKEN_PATH)?.toString() || '{}';
    } catch (err) {
      console.log(err.message);
    }

    token = JSON.parse(token);

    if (token?.token_type) {
      oauth2Client.credentials = token;
      return oauth2Client;
    }

    token = JSON.parse(process.env[TOKEN_NAME]);
    if (token?.token_type) {
      oauth2Client.credentials = token;
      return oauth2Client;
    }
    
    token = await getNewToken(oauth2Client, TOKEN_PATH);
    if (token) {
      oauth2Client.credentials = token;
      return oauth2Client;
    }

    return null;
  } catch(err) {
    console.log(err);
    return null;
  }
}

function getNewToken(oauth2Client, TOKEN_PATH) {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
      rl.close();
      oauth2Client.getToken(code, function(err, token) {
        if (err) {
          console.log('Error while trying to retrieve access token', err);
          reject(null);
          return;
        }
        resolve(token);
        storeToken(token, TOKEN_PATH);
      });
    });
  });
}

function storeToken(token, TOKEN_PATH) {
  fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
    if (err) throw err;
    console.log('Token stored to ' + TOKEN_PATH);
  });
}