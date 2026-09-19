import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate, generateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(['buyer', 'manager', 'admin']).default('buyer'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, name.trim(), email.toLowerCase().trim(), passwordHash, role]
    );

    const token = generateToken({
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role,
    });

    res.status(201).json({
      user: { id: userId, name: name.trim(), email: email.toLowerCase().trim(), role },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to register user', message: err.message });
  }
});

router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const userRes = await query(
      `SELECT id, name, email, password_hash, role FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = userRes.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to log in', message: err.message });
  }
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userRes = await query(
      `SELECT id, name, email, role, created_at FROM users WHERE id = $1`,
      [req.user!.id]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: userRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve profile', message: err.message });
  }
});

export default router;
