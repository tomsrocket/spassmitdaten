const fs = require('fs');
const http = require('http');
const https = require('https');
const sharp = require('sharp');
const csvParse = require('csv-parse');
const screenshotApp = require('node-server-screenshot');
const YAML = require('yaml');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const csvParseAsync = promisify(csvParse);


// PREFERENCES / SETTINGS

// screenshots
const pageWidth = 1280;
const pageHeight = 1380; // make longer screenshots so we can cut off the silly cookiehinweis

// preview images
const thumbnailWidth = 800;
const jpgQuality = 65;


const args = process.argv.slice(2);
const numRowsToProcess = args[0] ? args[0] : 5;
const visitWebsites = args[1] ? args[1] : 0;

console.log('Processing Rows:', numRowsToProcess);
console.log('Use first command line argument for number of rows');


/**
 * Helper function for synchronous file reading
 */
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

    console.log('request params', params);

    return new Promise((resolve, reject) => {
        // eslint-disable-next-line consistent-return
        const req = lib.get(url, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return resolve([res.statusCode, '']);
            }

            const data = [];

            res.on('data', (chunk) => {
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
let spreadsheetRange = '';
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
        console.log('Spreadsheet url:', spreadsheetUrl);
        console.log('Unused spreadsheet range:', spreadsheetRange);

        // Read url content
        const [responseCode, data] = await httpsRequestAsync(
            spreadsheetUrl,
        );
        console.log('Response code:', responseCode, 'Downloaded bytes:', data.length);

        // Parse csv into output array
        const parsed = await csvParseAsync(data);
        console.log('Found lines:', parsed.length);

        // Process every line of CSV file
        // eslint-disable-next-line no-restricted-syntax
        for (const line of parsed) {
            lineCounter += 1;
            if (lineCounter <= numRowsToProcess) {
                // eslint-disable-next-line no-await-in-loop
                await processRow(line).catch((err) => {
                    console.error(err);
                    throw new Error('Fehler in Zeile: ');
                });
            }
        }
    } catch (err) {
        console.error('Error in main function:', err);
    }

    console.log('');
    console.log('DONE');
})();


/**
 * @param {Array} row
 *  Link  Datum  Typ   Cat-Neu   Lang  Region Relevanz  Stichworte  Titel  Beschreibung
 *   0     1     2     3         4     5       6        7           8      9
*/
// eslint-disable-next-line consistent-return
async function processRow(row) {
    process.stdout.write(`#${lineCounter}`);
    process.stdout.write(' -> ');

    if (!row[0]) {
        console.log('SKIP because empty first column');
        return new Promise(((resolve) => { resolve(); }));
    }

    const date = row[1];
    const parts = date.match(/(\d+)/g);
    if (!(parts && (parts.length === 3))) {
        console.log(`SKIP because date column is not a date: ${date}`);
        return new Promise(((resolve) => { resolve(); }));
    }
    if (!(row[3] && row[8])) {
        console.log('SKIP because empty category or title');
        return new Promise(((resolve) => { resolve(); }));
    }

    const url = row[0];
    const type = row[2];
    const categories = row[3] ? row[3].replace(/, /g, '##').replace(/ \//g, ',').split('##') : [];
    const language = row[4];
    const region = row[5];
    const relevance = row[6];
    const tags = row[7] ? row[7].split(', ') : [];
    const title = row[8].replace(/"/g, '\\"');
    const desc = row[9] ? row[9] : '';

    process.stdout.write(`${title} -> `);


    const jsDate = new Date(parts[2], parts[1] - 1, parts[0]);
    const isoDate = myDateFormat(jsDate);

    const slug = title.toLowerCase().replace(/[^üöäßÄÖÜ\w\d]+/g, '-').replace(/^-/, '');
    const categoryString = categories.join(']\n - [');
    const tagString = tags.join(']\n - [');

    const filename = `${slug}.md`;
    const outputfile = `../blog/source/_posts/${filename}`;

    // read last crawl information
    let responseCode = 0;
    let responseSize = 0;
    let lastCrawlDate = 0;
    let screenshotDate = 0;
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
        screenshotDate = yamlData.get('screenshotDate');
        if ((screenshotDate === 'undefined') || !screenshotDate) { screenshotDate = myDateFormat(new Date()); }
        console.log('[o] Old status', responseCode, responseSize, lastCrawlDate, screenshotDate);
    }
    // get new crawl information
    if (visitWebsites || !lastCrawlDate) {
        console.log(' [/] (Re-)visiting website..');
        let data = '';
        [responseCode, data] = await httpsRequestAsync(
            url,
        );
        responseSize = data.length;
        lastCrawlDate = myDateFormat(new Date());
        console.log('[n] New status', responseCode, responseSize, lastCrawlDate);
    }

    // check if screenshot should be made
    const address = url;
    const largeScreenshotFile = `../screenshots/${slug}.png`;
    const publishedScreenshot = `../blog/source/thumbnails/${slug}.jpg`;
    let takeScreenshot = false;
    if (address.match(/\.pdf$/i)) {
        console.log('SKIP because TODO: PDF screenshots not implemented');
    } else if (!(fs.existsSync(largeScreenshotFile) && fs.statSync(largeScreenshotFile).size > 50)) {
        takeScreenshot = true;
        screenshotDate = myDateFormat(new Date());
    }

    // TODO INFERNO ERRORS IN HEXO BECAUSE OF ISO DATE FORMAT!! fix by using a differnet date format

    // compile hexo markdown content for article
    const content = `---
title: "${title}"
date: ${isoDate}
slug: ${slug}
lang: ${language}
rank: ${relevance}
type: ${type}
thumbnail: /thumbnails/${slug}.jpg
external: ${url}
region: ${region}
responseCode: ${responseCode}
responseSize: ${responseSize}
lastCrawlDate: ${lastCrawlDate}
screenshotDate: ${screenshotDate}
categories: 
 - [${categoryString}]
tags: 
 - [${tagString}]
---
${desc}

`;

    // write hexo markdown file
    fs.writeFileSync(outputfile, content);
    const filestats = fs.statSync(outputfile);
    if (!filestats.size) {
        const err = `File is empty: ${outputfile}`;
        console.log(err);
        return new Promise(((resolve, reject) => { reject(err); }));
    }

    // generate screensot and thumbnail
    if (takeScreenshot) {
        process.stdout.write(`Screenshot target: ${largeScreenshotFile}`);
        await loadPage(address, largeScreenshotFile);
        if (!(fs.existsSync(largeScreenshotFile) && fs.statSync(largeScreenshotFile).size > 50)) {
            console.log('OOPS! SKIPPING THUMBNAIL! Screenshot could not generated.');
        }
    }
    if ((fs.existsSync(largeScreenshotFile) && fs.statSync(largeScreenshotFile).size > 50)
        && !(fs.existsSync(publishedScreenshot) && fs.statSync(publishedScreenshot).size > 50)) {
        process.stdout.write(` [/] Generating thumbnail: ${publishedScreenshot}`);
        await convert(largeScreenshotFile, publishedScreenshot, { width: thumbnailWidth });
    }
    console.log('(^^)');

    // We dont need to always return a promise. In an async funtion any non-promise-response
    // will be wrapped in a resolved promise automagically.
}


/**
 * Take screenshot of page
 * @param {string} address
 * @param {string} output
 */
async function loadPage(address, output) {
    process.stdout.write(` -> Screenshot source: ${address}`);

    return new Promise(((resolve, reject) => {
        screenshotApp.fromURL(address, output, {
            width: pageWidth,
            height: pageHeight,
        }, (err) => {
            if (err) {
                console.log('Error during screenshot: ', err);
                reject(err);
            }
            process.stdout.write(' -> [x] Success');

            resolve();
        });
    }));
}


/**
 * Create different image size
 * @param {string} inputFile
 * @param {string} outputFile
 * @param {*} resizeOptions
 */
async function convert(inputFile, outputFile, resizeOptions) {
    return new Promise(((resolve, reject) => {
        sharp(inputFile)
            .resize(resizeOptions)
            .jpeg({
                quality: jpgQuality,
                chromaSubsampling: '4:4:4',
            })
            .toFile(outputFile)
            .then((newFileInfo) => {
                process.stdout.write(' -> [x] Success');
                resolve(newFileInfo);
            })
            .catch((err) => {
                console.log('Error occured');
                reject(err);
            });
    }));
}
/**
 * Date format needs to be special, because otherwise inferno will parse them as objects and throw crazy errors in hexo
 * @param {Date} date
 */
function myDateFormat(date) {
    return date.toISOString().replace('T', ' ');
}
