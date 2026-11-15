FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache su-exec
COPY package.json server.js ./
COPY autonomy ./autonomy
COPY economy ./economy
COPY public ./public
RUN mkdir -p /data && chown -R node:node /app /data
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
EXPOSE 3000
CMD ["sh","-c","chown -R node:node /data && exec su-exec node node server.js"]
