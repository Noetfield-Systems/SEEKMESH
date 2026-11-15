FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
COPY autonomy ./autonomy
COPY public ./public
RUN mkdir -p /data && chown -R node:node /data /app
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
USER node
EXPOSE 3000
CMD ["node","server.js"]
