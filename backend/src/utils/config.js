/**
 * Punto unico para leer variables de entorno.
 * Agregar aqui cada variable que use el microservicio, con su valor por
 * defecto cuando aplique. El resto del codigo debe importar desde este modulo
 * y nunca leer process.env directamente.
 */
export default {
  API_BASE_PATH: process.env.API_BASE_PATH || '/api/v1',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: Number(process.env.REDIS_PORT || 6379),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  NOTIFICATION_STREAM: process.env.NOTIFICATION_STREAM || 'notifications:dispatch'
};
