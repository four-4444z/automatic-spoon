import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const HOST = process.env.HOST || '127.0.0.1';

wisp.options.allow_udp_streams = false;
wisp.options.allow_private_ips = false;
wisp.options.allow_loopback_ips = false;

const app = Fastify({
  logger: false,
  serverFactory: (handler) => createServer()
    .on('request', (request, response) => {
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      handler(request, response);
    })
    .on('upgrade', (request, socket, head) => {
      if (new URL(request.url, 'http://localhost').pathname === '/wisp/') {
        wisp.routeRequest(request, socket, head);
      } else {
        socket.destroy();
      }
    })
});

app.get('/embed.html', async (_request, reply) => {
  reply.type('text/html; charset=utf-8').header('cache-control', 'no-store');
  return readFile(new URL('./scramjet-embed.html', import.meta.url));
});

app.get('/scramjet-sw.js', async (_request, reply) => {
  reply.type('text/javascript; charset=utf-8').header('cache-control', 'no-store');
  return readFile(new URL('./scramjet-sw.js', import.meta.url));
});

app.get('/health', async () => ({ status: 'ok' }));

app.register(fastifyStatic, {
  root: scramjetPath,
  prefix: '/scram/',
  decorateReply: false
});
app.register(fastifyStatic, {
  root: libcurlPath,
  prefix: '/libcurl/',
  decorateReply: false
});
app.register(fastifyStatic, {
  root: baremuxPath,
  prefix: '/baremux/',
  decorateReply: false
});

app.setNotFoundHandler((_request, reply) => {
  reply.code(404).type('text/plain').send('Not found.');
});

export async function startScramjetServer(port, host = HOST) {
  await app.listen({ host, port });
  const address = app.server.address();
  return {
    close: () => app.close(),
    host,
    port: typeof address === 'object' && address ? address.port : port
  };
}
