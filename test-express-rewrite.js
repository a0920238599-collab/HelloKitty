const express = require('express');
const app = express();
app.get('/api/claim-status', (req, res) => res.send('MATCHED claim-status'));
app.get('/api/index', (req, res) => res.send('MATCHED index'));
app.use((req, res) => res.send('NOT MATCHED: ' + req.url));

const req = { method: 'GET', url: '/api/index' };
// Vercel rewrites change req.url to destination, but also sets req.headers['x-now-route-matches'] or similar.
