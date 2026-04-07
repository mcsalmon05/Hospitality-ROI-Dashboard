const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { readAll, writeOne } = require('../services/db');
const DATA_PATH = path.join(__dirname, '../data/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

const readUsers = () => {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (err) {
    return [];
  }
};

const writeUsers = (data) => {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
};

const fetchAllUsers = async () => {
  try {
    const list = await readAll('users', DATA_PATH);
    if (!list || list.length === 0) return readUsers();
    return list;
  } catch (e) {
    return readUsers();
  }
};

// --- AUTH ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  const users = await fetchAllUsers();
  
  const parsedEmail = (email || '').trim().toLowerCase();
  console.log(`[Auth] Login attempt for: ${parsedEmail}`);
  
  const user = users.find(u => (u.email || '').toLowerCase() === parsedEmail);
  if (!user) {
    console.warn(`[Auth] User not found: ${parsedEmail}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  try {
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.warn(`[Auth] Password mismatch for: ${parsedEmail}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log(`[Auth] Login successful: ${parsedEmail} (Role: ${user.role})`);
    const token = jwt.sign({ id: user.id, role: user.role, accountIds: user.accountIds || [] }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, role: user.role });
  } catch (err) {
    console.error(`[Auth] Bcrypt error:`, err.message);
    res.status(500).json({ error: 'Internal security error' });
  }
});

// Middleware for verifying JWT
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// --- USER MANAGEMENT ---
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  const users = await fetchAllUsers();
  res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, accountIds: u.accountIds })));
});

router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email, password, name, role, accountIds } = req.body;
    const users = await fetchAllUsers();
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already exists' });
    
    const hash = await bcrypt.hash(password, 10);
    const newUser = {
      id: `u-${uuidv4().split('-')[0]}`,
      email,
      name,
      password: hash,
      role: role || 'client',
      accountIds: accountIds || []
    };
    
    users.push(newUser);
    // Write local
    writeUsers(users);
    // Write cloud
    await writeOne('users', newUser.id, newUser);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const users = await fetchAllUsers();
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    
    users[idx].password = await bcrypt.hash(newPassword, 10);
    
    writeUsers(users);
    await writeOne('users', users[idx].id, users[idx]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { router, authMiddleware, adminMiddleware };
