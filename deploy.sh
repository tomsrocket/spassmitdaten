#!/bin/bash

cd blog
npx hexo clean
npx hexo generate
npx hexo deploy
