FROM node:16 as builder

ARG BACKEND_URL
ENV BACKEND_URL=${BACKEND_URL}

ARG SIIBRA_API_ENDPOINTS
ENV SIIBRA_API_ENDPOINTS=${SIIBRA_API_ENDPOINTS:-https://siibra-api-stable.apps.hbp.eu/v2_0,https://siibra-api-stable-ns.apps.hbp.eu/v2_0,https://siibra-api-stable.apps.jsc.hbp.eu/v2_0}

ARG STRICT_LOCAL
ENV STRICT_LOCAL=${STRICT_LOCAL:-false}

ARG KIOSK_MODE
ENV KIOSK_MODE=${KIOSK_MODE:-false}

ARG MATOMO_URL
ENV MATOMO_URL=${MATOMO_URL}

ARG MATOMO_ID
ENV MATOMO_ID=${MATOMO_ID}

ARG EXPERIMENTAL_FEATURE_FLAG
ENV EXPERIMENTAL_FEATURE_FLAG=${EXPERIMENTAL_FEATURE_FLAG:-false}

ARG ENABLE_LEAP_MOTION
ENV ENABLE_LEAP_MOTION=${ENABLE_LEAP_MOTION:-false}

# mkdir, and copy package.json and package-lock.json and npm i
# to effectively use the caching layer

RUN mkdir /iv
WORKDIR /iv
COPY ./package.json /iv/
COPY ./package-lock.json /iv/
RUN npm i

COPY . /iv/

# angular 12 echo the env var into src/environments/environment.prod.ts
RUN node ./src/environments/parseEnv.js

RUN npm run build
RUN node third_party/matomo/processMatomo.js
RUN npm run build-storybook

# gzipping container
FROM ubuntu:22.04 as compressor
RUN apt upgrade -y && apt update && apt install brotli

RUN mkdir /iv
COPY --from=builder /iv/dist/aot /iv
COPY --from=builder /iv/storybook-static /iv/storybook-static

# Remove duplicated assets. Use symlink instead.
WORKDIR /iv/storybook-static
RUN rm -rf ./assets
RUN ln -s ../assets ./assets

WORKDIR /iv

RUN for f in $(find . -type f); do gzip < $f > $f.gz && brotli < $f > $f.br; done

# prod container
FROM node:16-alpine

ENV NODE_ENV=production

RUN apk --no-cache add ca-certificates
RUN mkdir /iv-app
WORKDIR /iv-app

# Copy common folder
COPY --from=builder /iv/common /common

# Copy the express server
COPY --from=builder /iv/deploy .

# Copy built interactive viewer
COPY --from=compressor /iv ./public

RUN chown -R node:node /iv-app

USER node
RUN npm i

EXPOSE 8080
ENV PORT 8080
ENTRYPOINT [ "node", "server.js" ]
