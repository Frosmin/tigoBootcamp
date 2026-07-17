import ultimateExpress from 'ultimate-express';
import promBundle from 'express-prom-bundle';
import helmet from 'helmet';
import routerRoutes from './routes/router.routes.js';
import bodyParser from 'body-parser';
import { httpLoggerMiddleware } from '@tigo/logger';
import { initializeRedis } from '@tigo/redis-connector';
import config from './utils/config.js';
const app = ultimateExpress({ threads: 0 });

app.use(helmet());
initializeRedis();
const metricsMiddleware = promBundle({ includeMethod: true });

app.disable('x-powered-by');
app.use(bodyParser.json());

app.use(httpLoggerMiddleware());
app.use(metricsMiddleware);

app.use(helmet.noSniff());

app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      defaultSrc: ['\'none\''],
      scriptSrc: ['\'none\''],
      styleSrc: ['\'none\''],
      objectSrc: ['\'none\''],
      baseUri: ['\'none\''],
      frameAncestors: ['\'none\'']
    }
  })
);

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

app.use(config.API_BASE_PATH, routerRoutes);

export default app;
