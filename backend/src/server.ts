import { AppDataSource } from "./config/data-source";
import { createApp } from "./app";
import { env } from "./config/env";
import { runSeed } from "./config/seed";

async function bootstrap() {
  try {
    await AppDataSource.initialize();
    console.log("✔ Base de datos conectada");

    // Siembra el admin inicial y datos de ejemplo (idempotente).
    await runSeed();

    const app = createApp();
    app.listen(env.port, () => {
      console.log(`✔ API escuchando en http://localhost:${env.port}/api`);
    });
  } catch (err) {
    console.error("✖ Error al iniciar el servidor:", err);
    process.exit(1);
  }
}

bootstrap();
