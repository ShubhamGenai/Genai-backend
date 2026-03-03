#!/bin/bash



# Backend
cd /home/genai/Genai-backend || exit
git pull origin main
npm install --production
pm2 reload Genai-backend



