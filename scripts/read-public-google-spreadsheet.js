"use strict";

const fs = require('fs');
const md5 = require('md5');
const http = require('http');
const https = require('https');
const sharp = require('sharp');
const csvParse = require('csv-parse')
const screenshotApp = require("node-server-screenshot");

const { promisify } = require('util')
const readFileAsync = promisify(fs.readFile)
const csvParseAsync = promisify(csvParse);



// PREFERENCES / SETTINGS

// screenshots  
var pageWidth = 1280;
var pageHeight = 1380; // make longer screenshots so we can cut off the silly cookiehinweis

// preview images
const thumbnailWidth = 800;
const jpgQuality = 65;





var args = process.argv.slice(2);
let numRowsToProcess = args[0] ? args[0] : 5;

console.log("Processing Rows:", numRowsToProcess);
console.log("Use first command line argument for number of rows");


// helper function for synchronous file reading
const httpsRequestAsync = async (url, method = 'GET', postData) => {
    const lib = url.startsWith('https://') ? https : http;
    const urlparts = url.split('://')[1].split('/');
    const h = urlparts.shift();
    const path = urlparts.join('/');
    const [host, port] = h.split(':');
  
    const params = {
        method,
        host,
        port: port || url.startsWith('https://') ? 443 : 80,
        path: path || '/',
    };

    console.log("request params", params)
  
    return new Promise((resolve, reject) => {
      const req = lib.get(url, res => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Status Code: ${res.statusCode}`));
        }
  
        const data = [];
  
        res.on('data', chunk => {
          data.push(chunk);
        });
  
        res.on('end', () => resolve(Buffer.concat(data).toString()));
      });
  
      req.on('error', reject);
  
      if (postData) {
        req.write(postData);
      }
  
      req.end();
    });
  };

let spreadsheetUrl = '';
let spreadsheetRange = "";
let lineCounter = 0;

/**
 * Main function
 */
(async () => {

    try {
        // Load spreadsheet Url from config file
        const content = await readFileAsync('config/config.json');
        const config = JSON.parse(content);
        spreadsheetUrl = config.spreadsheetCsvUrlPublic;
        spreadsheetRange = config.spreadsheetRange;
        console.log("Spreadsheet url:", spreadsheetUrl)

        // Read url content
        const data = await httpsRequestAsync(
            spreadsheetUrl,
        );
        console.log("Downloaded bytes:", data.length);

        // Parse csv into output array
        const parsed = await csvParseAsync(data);
        console.log("Found lines:", parsed.length);

        // Process every line of CSV file
        for (const line of parsed) {
            lineCounter += 1;
            if (lineCounter <= numRowsToProcess) {
                await processRow(line).catch(function(err) {
                    console.error(err);  
                    throw "Fehler";
                });
            }
        }

    } catch (err) {
        console.error("Error in main function:", err);
    }

    console.log("");
    console.log("DONE");

})();





    /*
    Link	Datum	Typ	 Relevanz	Stichworte	Region	Titel	Beschreibung
    0       1        2   3            4          5         6       7
    */
async function processRow(row) {
    process.stdout.write("#" + lineCounter);
    process.stdout.write(" -> ");

    if (!row[0]) {
        console.log("SKIP because empty first column")
        return new Promise(function(resolve, reject) {resolve();});
    }

    const date = row[1];
    const parts = date.match(/(\d+)/g);
    if (!(parts && (parts.length === 3))) {
        console.log("SKIP because date column is not a date: " + date );
        return new Promise(function(resolve, reject) {resolve();});        
    }

    const title = row[6];
    const keywords = row[4] ? row[4].split(", ") : [];
    const url = row[0];
    const category = row[2];
    const desc = row[7] ? row[7] : "";
    const mdfive = md5(url);

    process.stdout.write(title + " -> ");

    const jsDate = new Date(parts[2], parts[1]-1, parts[0]);
    const isoDate = jsDate.toISOString();

    const slug = title.toLowerCase().replace(/[^üöäßÄÖÜ\w\d]+/g, "-").replace(/^-/, "");
    const categoryString = keywords.join("]\n - [")

    const content = `---
title: ${title}
date: ${isoDate}
slug: ${slug}
thumbnail: /thumbnails/${slug}.jpg
external: ${url}
categories: 
 - [${categoryString}]
tags: 
 - ${category}
---
${desc}

`;

    const filename = slug + ".md"
    
    const outputFile = "../blog/source/_posts/" + filename;
    fs.writeFileSync(outputFile, content); 
    const filestats = fs.statSync(outputFile);
    if (!filestats.size) {
        console.log(err);
        return new Promise(function(resolve, reject) {reject(err);});
    }

       
    const address = url;
    var largeScreenshotFile = "../screenshots/" + slug + ".png";
    var publishedScreenshot = "../blog/source/thumbnails/" + slug + ".jpg";

    if (address.match(/\.pdf$/i)) {
        console.log("SKIP because TODO: PDF screenshots not implemented");
    } else {

        if (!(fs.existsSync(largeScreenshotFile) && fs.statSync(largeScreenshotFile).size > 50)) {

            console.log("Generating screenshot: ", largeScreenshotFile);
            await loadPage(address, largeScreenshotFile);   
        }

        if (!(fs.existsSync(publishedScreenshot) && fs.statSync(publishedScreenshot).size > 50)) {        

            console.log("Generating thumbnail: ", largeScreenshotFile);
            await convert(largeScreenshotFile, publishedScreenshot, { width: thumbnailWidth, height: thumbnailHeight, position: "top" });
        } 
    } 
    // We dont need to always return a promise. In an async funtion any non-promise-response will be wrapped in a resolved promise automagically.
}



/**
 * Take screenshot of page
 * @param {string} address 
 * @param {string} output 
 */
async function loadPage(address, output)
{
    console.log("Processing", address);
    
    return new Promise(function(resolve, reject) {
 
        screenshotApp.fromURL(address, output, {
            width: pageWidth,
            height: pageHeight, 
        }, function(){
            console.log("wrote " + output);
            resolve();
        });
    });
}



/**
 * Create different image size
 * @param {*} inputFile 
 * @param {*} outputFile 
 * @param {*} resizeOptions 
 */
async function convert(inputFile, outputFile, resizeOptions) {
  return new Promise(function(resolve, reject) {
      sharp(inputFile)
      .resize(resizeOptions)
      .jpeg({
          quality: jpgQuality,
          chromaSubsampling: '4:4:4'
      })
      .toFile(outputFile)
          .then(function(newFileInfo) {
              console.log("Success");
              resolve(newFileInfo);
          })
          .catch(function(err) {
              console.log("Error occured");
              reject(err);
          });    
      });
}

