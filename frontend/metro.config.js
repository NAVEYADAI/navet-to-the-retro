const https = require('https');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable .mjs and .cjs extensions for modern ESM libraries like framer-motion
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

// Dev counterpart of the /ingest PostHog proxy in nginx.conf — the web client always sends to
// same-origin /ingest (see src/lib/analytics.ts), so the dev server needs to forward it too.
const POSTHOG_INGEST_HOST = 'https://eu.i.posthog.com';

function proxyToPostHog(req, res) {
  const target = new URL(req.url.slice('/ingest'.length), POSTHOG_INGEST_HOST);
  const upstream = https.request(
    target,
    { method: req.method, headers: { ...req.headers, host: target.host } },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.statusCode = 502;
    res.end();
  });
  req.pipe(upstream);
}

const previousEnhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const base = previousEnhanceMiddleware ? previousEnhanceMiddleware(middleware, server) : middleware;
  return (req, res, next) => {
    if (req.url && req.url.startsWith('/ingest/')) return proxyToPostHog(req, res);
    return base(req, res, next);
  };
};

module.exports = config;
