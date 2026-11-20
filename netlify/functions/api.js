const { createAppServer } = require('../../src/server');

let cachedApp = null;

function getApp() {
  if (!cachedApp) {
    const dbPath = process.env.DB_PATH || '/tmp/localspin.sqlite';
    cachedApp = createAppServer({ dbPath });
  }
  return cachedApp;
}

exports.handler = async function handler(event) {
  try {
    const app = getApp();
    let reqPath = event.path || '/';
    if (reqPath.startsWith('/.netlify/functions/api')) {
      const suffix = reqPath.slice('/.netlify/functions/api'.length);
      reqPath = `/api${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
    }
    const query = event.rawQuery ? `?${event.rawQuery}` : '';
    const fullUrl = `${reqPath}${query}`;

    let body = null;
    if (event.body) {
      body = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body;
    }

    const res = await app.dispatch({
      method: event.httpMethod || 'GET',
      url: fullUrl,
      headers: event.headers || {},
      body
    });

    const text = await res.text();
    const contentType = res.headers.get('content-type') || 'application/json; charset=utf-8';
    return {
      statusCode: res.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
