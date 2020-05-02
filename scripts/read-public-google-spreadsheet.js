"use strict";

const fs = require('fs');
const md5 = require('md5');
const http = require('http');
const https = require('https');
const sharp = require('sharp');
const csvParse = require('csv-parse')
const screenshotApp = require("node-server-screenshot");
const YAML = require('yaml')

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





const args = process.argv.slice(2);
const numRowsToProcess = args[0] ? args[0] : 5;
const visitWebsites = args[1] ? args[1]: 0;

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
          return resolve([res.statusCode, '']);
        }
  
        const data = [];
  
        res.on('data', chunk => {
          data.push(chunk);
        });
  
        res.on('end', () => resolve([res.statusCode, Buffer.concat(data).toString()]));
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
        const [responseCode, data] = await httpsRequestAsync(
            spreadsheetUrl
        );
        console.log("Response code:", responseCode, "Downloaded bytes:", data.length);

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

    const url = row[0];
    const category = row[2];
    const keywords = row[4] ? row[4].split(", ") : [];
    const region = row[5]
    const title = row[6].replace(/"/g,'\\"');
    const desc = row[7] ? row[7] : "";
    const mdfive = md5(url);

    process.stdout.write(title + " -> ");


    const jsDate = new Date(parts[2], parts[1]-1, parts[0]);
    const isoDate = jsDate.toISOString();

    const slug = title.toLowerCase().replace(/[^üöäßÄÖÜ\w\d]+/g, "-").replace(/^-/, "");
    const categoryString = keywords.join("]\n - [")

    const filename = slug + ".md"
    const outputfile = "../blog/source/_posts/" + filename;

    // read last crawl information
    let responseCode = 0;
    let responseSize = 0;
    let lastCrawlDate = 0;
    if (fs.existsSync(outputfile)) {
        const oldContent = await readFileAsync(outputfile);
//        console.log("oldcontent", oldContent.toString());
        const oldYaml = YAML.parseAllDocuments(oldContent.toString());
        const yamlData = oldYaml[0];
//        console.log("OLD YAML", filename, yamlData );
//        good way to access the yaml data as javascript object:yamlData.toJSON();
        responseCode = yamlData.get('responseCode');
        responseSize = yamlData.get('responseSize');
        lastCrawlDate = yamlData.get('lastCrawlDate');
        console.log("[o] Old status", responseCode, responseSize, lastCrawlDate);
    }
    // get new crawl information
    if (visitWebsites || !lastCrawlDate) {
        console.log(" [/] (Re-)visiting website..")
        let data = '';
        [responseCode, data] = await httpsRequestAsync(
            url
        );
        responseSize = data.length;
        lastCrawlDate = new Date().toISOString();
        console.log("[n] New status", responseCode, responseSize, lastCrawlDate);
    }

    // compile hexo markdown content for article
    const content = `---
title: "${title}"
date: ${isoDate}
slug: ${slug}
thumbnail: /thumbnails/${slug}.jpg
external: ${url}
region: ${region}
responseCode: ${responseCode}
responseSize: ${responseSize}
lastCrawlDate: ${lastCrawlDate}
categories: 
 - [${categoryString}]
tags: 
 - ${category}
---
${desc}

`;

    // write hexo markdown file 
    fs.writeFileSync(outputfile, content); 
    const filestats = fs.statSync(outputfile);
    if (!filestats.size) {
        console.log(err);
        return new Promise(function(resolve, reject) {reject(err);});
    }
       
    // generate screensot and thumbnail
    const address = url;
    var largeScreenshotFile = "../screenshots/" + slug + ".png";
    var publishedScreenshot = "../blog/source/thumbnails/" + slug + ".jpg";

    if (address.match(/\.pdf$/i)) {
        console.log("SKIP because TODO: PDF screenshots not implemented");
    } else {

        if (!(fs.existsSync(largeScreenshotFile) && fs.statSync(largeScreenshotFile).size > 50)) {

            process.stdout.write("Screenshot target: " + largeScreenshotFile);
            await loadPage(address, largeScreenshotFile);   
            if (!(fs.existsSync(largeScreenshotFile) && fs.statSync(largeScreenshotFile).size > 50)) {
                console.log("OOPS! SKIPPING THUMBNAIL! Screenshot could not generated.");
            }
        }

        if ((fs.existsSync(largeScreenshotFile) && fs.statSync(largeScreenshotFile).size > 50)
            && !(fs.existsSync(publishedScreenshot) && fs.statSync(publishedScreenshot).size > 50)) {        

            process.stdout.write(" [/] Generating thumbnail: " + publishedScreenshot);
            await convert(largeScreenshotFile, publishedScreenshot, { width: thumbnailWidth});
        } 
        console.log("(^^)");
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
    process.stdout.write(" -> Screenshot source: " + address);
    
    return new Promise(function(resolve, reject) {
 
        screenshotApp.fromURL(address, output, {
            width: pageWidth,
            height: pageHeight, 
        }, function(err){
            if (err) {
                console.log("Error during screenshot: ", err);
                reject(err);
            }
            process.stdout.write(" -> [x] Success");

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
              process.stdout.write(" -> [x] Success");
              resolve(newFileInfo);
          })
          .catch(function(err) {
              console.log("Error occured");
              reject(err);
          });    
      });
}

