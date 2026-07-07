import { buildApp } from './app.js';
import { env } from './config/env.js';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`TiSei API listening on ${env.API_BASE_URL}`);
    app.log.info(`Swagger UI: ${env.API_BASE_URL}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
