#!/bin/bash

cd scripts
npm run generate
cd ..

cd blog
npx hexo clean
npx hexo generate
npx hexo deploy
