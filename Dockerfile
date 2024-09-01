FROM node:20

WORKDIR /usr/src/app

COPY . .

# SSH enablement
# https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container?tabs=debian&pivots=container-linux#enable-ssh
RUN apt-get update \
    && apt-get install -y --no-install-recommends dialog \
    && apt-get install -y --no-install-recommends openssh-server \
    && echo "root:Docker!" | chpasswd \
    && chmod u+x ./entrypoint.sh
COPY ./docker/sshd_config /etc/ssh/

EXPOSE 8000 2222

# Build
RUN yarn install
RUN yarn run build
RUN npm install pm2 -g

EXPOSE 8080

ENTRYPOINT [ "./entrypoint.sh" ]