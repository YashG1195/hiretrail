import { Router } from 'express';
import { register, login, refresh, logout, getMe } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected route
router.get('/me', authMiddleware, getMe);

export default router;
