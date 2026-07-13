import express from 'express';
const app = express();
app.get('/api/test-500', (req, res) => {
  res.status(500).json({ error: "Test JSON error" });
});
