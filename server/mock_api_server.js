import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3005; // Mock Server Port

// Login Endpoint
app.post('/api/auth/login', (req, res) => {
    console.log('[MockServer] Login Request Body:', req.body);

    // Expect dynamic params: e.g. 'cpf' and 'password'
    if (req.body.cpf === '123' && req.body.password === 'secret' && req.body.app_id === '999') {
        return res.json({
            success: true,
            data: {
                token: 'mock-access-token-xyz'
            }
        });
    }

    return res.status(401).json({ error: 'Invalid Credentials' });
});

// Protected Endpoint
app.get('/api/protected/data', (req, res) => {
    const authHeader = req.headers.authorization;
    console.log('[MockServer] Protected Request Headers:', req.headers);

    if (authHeader === 'Bearer mock-access-token-xyz') {
        return res.json({ message: 'Success! You accessed protected data.' });
    }

    return res.status(401).json({ error: 'Unauthorized Access' });
});

app.listen(PORT, () => {
    console.log(`Mock API Server running on port ${PORT}`);
});
