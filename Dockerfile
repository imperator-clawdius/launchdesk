FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4177
ENV DATA_FILE=/data/launchdesk.json

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public

EXPOSE 4177
VOLUME ["/data"]
CMD ["node", "src/server.js"]
