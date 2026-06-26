import { createApp } from './app';
import { env } from './config/env';
import { pool } from './config/database';

async function start(): Promise<void> {
  // Test database connection on startup
  try {
    const client = await pool.connect();
    console.log('PostgreSQL database connected successfully.');
    client.release();
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal}: shutting down gracefully…`);
    server.close(async () => {
      await pool.end();
      console.log('Database pool closed. Bye.');
      process.exit(0);
    });

    // Force-exit if graceful shutdown takes too long
    setTimeout(() => {
      console.error('Forced exit after shutdown timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    server.close(() => process.exit(1));
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Trigger dev server restart to clear pg prepared statements cache
