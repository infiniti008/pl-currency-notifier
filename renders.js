import axios from 'axios';
import fs from 'fs';
import Handlebars from 'handlebars';

const generators = {};
const imageRenderHost = process.env.imageRenderHost;

generators.base64 = async function (content, templateName, saveToFile, fileName) {
  return new Promise(async(resolve, reject) => {
    try {
      const html = await fs.readFileSync(`./views/templates/${templateName}.html`).toString();
      const response = await axios.post(imageRenderHost + '/api/render', {
        data: {
          html,
          type: 'png',
          content,
          encoding: 'base64'
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
      console.log(e);
      reject(null);
    }
  });
}

generators.image = function (content, templateName) {
  return new Promise(async(resolve, reject) => {
    try {
      const html = await fs.readFileSync(`./views/templates/${templateName}.html`).toString();
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

generators.html = async function (content, templateName) {
  try {
    const templateSource = fs.readFileSync(`./views/templates/${templateName}.html`, 'utf8');

    const template = Handlebars.compile(templateSource);

    const renderedTemplate = template(content);

    fs.writeFileSync(`./views/html/${templateName}.html`, renderedTemplate);
  } catch (e) {
    console.log(e);
  }
}

export default generators;
