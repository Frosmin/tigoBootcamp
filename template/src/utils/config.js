/**
 * Punto unico para leer variables de entorno.
 * Agregar aqui cada variable que use el microservicio, con su valor por
 * defecto cuando aplique. El resto del codigo debe importar desde este modulo
 * y nunca leer process.env directamente.
 */
export default {
  API_BASE_PATH: process.env.API_BASE_PATH
};
