FROM node:22.22.1-trixie-slim

ENV TZ=America/La_Paz \
    NODE_ENV=production \
    APP_HOME=/app \
    PORT=3000
WORKDIR $APP_HOME

RUN addgroup --system app-group \
    && adduser --system --ingroup app-group --home $APP_HOME --shell /usr/sbin/nologin usr-app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --chown=usr-app:app-group . .
USER usr-app
EXPOSE $PORT
CMD ["node", "index.js"]
