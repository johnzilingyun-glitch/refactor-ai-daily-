import { Router } from 'express';
import { logDebug, logError } from './stockLogger.js';
import fs from 'fs';
import path from 'path';

const router = Router();
const LOG_FILE = path.join(process.cwd(), 'logs', 'debug_records.log');

router.post('/logs/debug', (req, res) => {
    const { type, data } = req.body;
    logDebug(type || 'client_debug', data);
    res.json({ success: true });
});

router.get('/logs/debug', (req, res) => {
    try {
        if (fs.existsSync(LOG_FILE)) {
            const content = fs.readFileSync(LOG_FILE, 'utf8');
            res.send(content);
        } else {
            res.send('No debug logs found.');
        }
    } catch (error) {
        logError(error, 'read_debug_logs');
        res.status(500).send('Error reading logs');
    }
});

router.delete('/logs/debug', (req, res) => {
    try {
        if (fs.existsSync(LOG_FILE)) {
            fs.writeFileSync(LOG_FILE, '');
            res.json({ success: true, message: 'Logs cleared' });
        } else {
            res.json({ success: true, message: 'No file to clear' });
        }
    } catch (error) {
        logError(error, 'clear_debug_logs');
        res.status(500).json({ error: 'Failed to clear logs' });
    }
});

export default router;
