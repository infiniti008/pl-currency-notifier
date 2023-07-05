import * as dotenv from 'dotenv';
dotenv.config({
  path: './.env'
});

import fs from 'fs';

const mediaFolderPath = process.env.mediaFolderPath;

const imagesFolder = fs.readdirSync(mediaFolderPath + '/images');
const imagesToRemove = getItemsToDelete(imagesFolder);
removeItems(imagesToRemove, '/images');

const videosFolder = fs.readdirSync(mediaFolderPath + '/videos');
const videosToRemove = getItemsToDelete(videosFolder);
removeItems(videosToRemove, '/videos');

function getItemsToDelete(items) {
  const date = new Date().toLocaleDateString('ru-RU');
  const dateToNumber = parseInt(date.split('.').reverse().join(''));
  
  const itemsToRemove = items.filter(item => {
    const itemDate = item.substr(0, 10);
    const itemDateToNumber = parseInt(itemDate.split('.').reverse().join(''));
    return itemDateToNumber < dateToNumber
  });

  return itemsToRemove;
}

function removeItems(items, folder) {
  items.forEach(item => {
    const pathToDelete = `${mediaFolderPath}${folder}/${item}`;
    try {
      fs.unlinkSync(pathToDelete);
    } catch (err) {
      console.log(err);
    }
  });
}