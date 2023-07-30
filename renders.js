import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import axios from 'axios';
import fs from 'fs';
import Handlebars from 'handlebars';

const environment = process.env.environment || 'prod';
const imageRenderHost = process.env['imageRenderHost_' + environment];
const videoRenderHost = process.env['videoRenderHost_' + environment];

const generators = {};

generators.base64 = async function (content, templateName, saveToFile, fileName, replace) {
  return new Promise(async(resolve, reject) => {
    try {
      let html = await fs.readFileSync(`./views/templates/${templateName}.hbs`).toString();
      if (replace) {
        replace.forEach(replaceItem => {
          html = html.replace(replaceItem.rule, replaceItem.string);
        });
      }
      const response = await axios.post(imageRenderHost + '/api/render', {
        data: {
          html,
          type: 'png',
          content,
          encoding: 'base64',
          quality: 100
        },
        headers: {
          'Content-Type': 'application/json'
        },
      });

      if (saveToFile) {
        fs.writeFileSync(`./views/base64/${fileName ? fileName : templateName}.txt`, response.data);
      }
      resolve(response.data);
    } catch(e) {
      console.log(e?.message);
      reject({});
    }
  });
}

generators.image = function (content, templateName) {
  return new Promise(async(resolve, reject) => {
    try {
      const html = await fs.readFileSync(`./views/templates/${templateName}.hbs`).toString();
      const response = await axios.post(imageRenderHost + '/api/render', {
        data: {
          html,
          type: 'png',
          content,
          encoding: 'binary'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }, { responseType: 'stream' });

        const fileName = content.fileName || templateName;
        const outputPath = `./views/image/${fileName}.png`;
      
        const outputStream = fs.createWriteStream(outputPath);
        const pipeline = response.data.pipe(outputStream);

        pipeline.on('finish', () => {
          console.log('File saved successfully.');
          content.outputPath = outputPath;
          resolve(content);
        });
        
        pipeline.on('error', (error) => {
          console.error('Error saving file:', error);
          reject(null);
      });

    } catch(e) {
      console.log(e);
      reject(null);
    }
  });
}

generators.video = async function (content) {
  return new Promise(async(resolve, reject) => {
    try {
      const response = await axios.post(videoRenderHost + '/api/generate-video', {
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
      reject({});
    }
  });
}

generators.html = async function (content, templateName) {
  try {
    const templateSource = fs.readFileSync(`./views/templates/${templateName}.hbs`, 'utf8');

    const template = Handlebars.compile(templateSource);

    const renderedTemplate = template(content);

    fs.writeFileSync(`./views/html/${templateName}.html`, renderedTemplate);
  } catch (e) {
    console.log(e);
  }
}

export default generators;
