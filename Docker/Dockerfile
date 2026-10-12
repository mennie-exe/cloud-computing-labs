FROM node:20-alpine
WORKDIR /app
COPY Site/package*.json ./
RUN npm install --omit=dev
COPY Site/ ./
EXPOSE 8080
CMD ["npm", "start"]
