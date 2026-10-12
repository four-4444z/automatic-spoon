const { createServer } = require('./server');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 5000);
const SCRAMJET_PORT = Number(process.env.SCRAMJET_PORT || 8080);

async function start() {
  const { startScramjetServer } = await import('./scramjet-server.mjs');
  const scramjet = await startScramjetServer(SCRAMJET_PORT);
  const systemCore = createServer(undefined, { scramjetPort: SCRAMJET_PORT });

  try {
    await new Promise((resolve, reject) => {
      systemCore.once('error', reject);
      systemCore.listen(PORT, HOST, resolve);
    });
  } catch (error) {
    await scramjet.close();
    throw error;
  }

  console.log(`SYSTEM_CORE is running at http://${HOST}:${PORT}`);
  console.log(`Scramjet is running at http://${HOST}:${SCRAMJET_PORT}`);

  const shutdown = () => {
    systemCore.close((error) => {
      if (error) console.error(`Unable to stop SYSTEM_CORE: ${error.message}`);
      scramjet.close().catch((closeError) => {
        console.error(`Unable to stop Scramjet: ${closeError.message}`);
      });
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error(`Unable to start SYSTEM_CORE and Scramjet: ${error.message}`);
  process.exitCode = 1;
});
