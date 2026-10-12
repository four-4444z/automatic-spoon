import { startScramjetServer } from './scramjet-server.mjs';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || process.env.SCRAMJET_PORT || 8080);

async function start() {
  const scramjet = await startScramjetServer(PORT, HOST);
  console.log(`Scramjet is listening on ${HOST}:${PORT}`);

  const shutdown = () => {
    scramjet.close().catch((error) => {
      console.error(`Unable to stop Scramjet: ${error.message}`);
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error(`Unable to start Scramjet: ${error.message}`);
  process.exitCode = 1;
});
