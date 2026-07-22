#########################
# BUILD FOR PRODUCTION
#########################

FROM --platform=linux/amd64 node:22-alpine AS build

WORKDIR /usr/src/app

RUN npm install -g pnpm

COPY --chown=node:node . .

RUN pnpm install --frozen-lockfile

RUN npx prisma generate

RUN npm run build:mkt

RUN npm run copy:mkt-templates

ENV NODE_ENV production

RUN pnpm install --prod --frozen-lockfile

USER node

###################
# PRODUCTION
###################

FROM --platform=linux/amd64 node:22-alpine AS production

ARG TARGETPLATFORM
ARG BUILDPLATFORM

RUN echo "I am running on $BUILDPLATFORM, building for $TARGETPLATFORM in environment production" > /log

COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist

EXPOSE 3001

CMD [ "node", "dist/apps/mkt/main.js" ]
