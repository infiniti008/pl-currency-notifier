import axios from 'axios';
import fs from 'fs';
import Handlebars from 'handlebars';
import stream from'stream';

const generators = {};

generators.base64 = async function (content, templateName) {
  try {
    const html = await fs.readFileSync(`./views/templates/${templateName}.html`).toString();
    const response = await axios.post('http://192.168.1.42:5100/api/render', {
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

    fs.writeFileSync(`./views/base64/${templateName}.txt`, response.data);
  } catch(e) {
    console.log(e);
  }
}

generators.image = async function (content, templateName) {
  try {
    const html = await fs.readFileSync(`./views/templates/${templateName}.html`).toString();
    const response = await axios.post('http://192.168.1.42:5100/api/render', {
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

      const outputPath = `./views/image/${templateName}.png`;
    
      const outputStream = fs.createWriteStream(outputPath);
      const pipeline = response.data.pipe(outputStream);

      pipeline.on('finish', () => {
        console.log('File saved successfully.');
      });
      
      pipeline.on('error', (error) => {
        console.error('Error saving file:', error);
    });

  } catch(e) {
    console.log(e);
  }
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
