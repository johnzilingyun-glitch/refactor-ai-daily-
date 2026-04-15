import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const HISTORY_DIR = path.join(process.cwd(), 'data', 'history');
const LOG_FILE = path.join(process.cwd(), 'data', 'optimization_log.json');

// Ensure directories exist
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'));
}
if (!fs.existsSync(HISTORY_DIR)) {
  fs.mkdirSync(HISTORY_DIR);
}
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
}

export function addLogEntry(field: string, oldValue: any, newValue: any, description: string) {
  try {
    const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
    logs.push({
      timestamp: new Date().toISOString(),
      field,
      oldValue,
      newValue,
      description
    });
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('Failed to add log entry:', err);
  }
}

function saveAnalysis(type: 'market' | 'stock', data: any) {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const dataWithId = { ...data, id, type };
  const filename = `${type}_${new Date().toISOString().replace(/[:.]/g, '-')}_${Math.random().toString(36).substr(2, 5)}.json`;
  const filePath = path.join(HISTORY_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(dataWithId, null, 2));
  console.log(`Analysis saved to ${filePath} with ID ${id}`);
}

const router = Router();

router.get('/history/context', (req, res) => {
  console.log('GET /api/history/context called');
  try {
    const files = fs.readdirSync(HISTORY_DIR).sort().reverse().slice(0, 10);
    const history = files.map(f => JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf-8')));
    res.json(history);
  } catch (err) {
    console.error('Failed to read history:', err);
    res.status(500).json({ error: 'Failed to read history' });
  }
});

router.get('/logs/optimization', (req, res) => {
  console.log('GET /api/logs/optimization called');
  try {
    const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
    res.json(logs);
  } catch (err) {
    console.error('Failed to read logs:', err);
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

router.post('/history/save', (req, res) => {
  console.log('--- SAVE REQUEST START ---');
  const { type, data } = req.body;
  console.log(`Type: ${type}`);
  if (data) {
    console.log(`Data size: ${JSON.stringify(data).length} bytes`);
  } else {
    console.log('Data is missing');
  }
  
  if (!type || !data) {
    console.error('Missing type or data in save request');
    return res.status(400).json({ error: 'Type and data are required' });
  }
  try {
    saveAnalysis(type, data);
    console.log(`Successfully saved ${type} analysis to history`);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to save analysis to history:', err);
    res.status(500).json({ error: 'Failed to save analysis to history', details: err instanceof Error ? err.message : String(err) });
  }
  console.log('--- SAVE REQUEST END ---');
});

router.post('/logs/add', (req, res) => {
  const { field, oldValue, newValue, description } = req.body;
  if (!field || !description) {
    return res.status(400).json({ error: 'Field and description are required' });
  }
  addLogEntry(field, oldValue, newValue, description);
  res.json({ success: true });
});

export default router;
