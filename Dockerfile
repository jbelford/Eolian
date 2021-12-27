FROM node:16

WORKDIR /usr/src/app

COPY . .
RUN yarn install
RUN yarn run build
RUN npm install pm2 -g

EXPOSE 8080

CMD ["pm2-runtime", "./dist/bundle.js"]