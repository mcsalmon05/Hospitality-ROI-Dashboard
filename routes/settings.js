const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isCloud, db, readAll, writeOne } = require('../services/db');

const SETTINGS_PATH = path.join(__dirname, '../data/settings.json');

// Helper to read settings (Hybrid)
const readSettings = async () => {
    const list = await readAll('settings', SETTINGS_PATH);
    // Settings is usually just 1 object or a known file
    if (Array.isArray(list) && list.length > 0) return list[0]; 
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
};

const writeSettings = async (settings) => {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    if (isCloud) {
        // Save as a single document in 'settings' collection
        await writeOne('settings', 'global_config', settings);
    }
};

// GET current settings
router.get('/', async (req, res) => {
    try {
        const settings = await readSettings();
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update settings (Admin Only)
router.put('/', async (req, res) => {
    try {
        const settings = await readSettings();
        const updated = { ...settings, ...req.body };
        await writeSettings(updated);
        res.json({ success: true, settings: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
