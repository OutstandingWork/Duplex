import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Initializing server...');
console.log('__filename:', __filename);
console.log('__dirname:', __dirname);

app.use(express.static(path.join(__dirname, 'client')));
app.use(express.json());

// Serve index.html for the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/index.html'));
});

app.get('/session', async (req, res) => {
  try {
    console.log('Fetching session from OpenAI...');
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'shimmer',
        instructions: 'You are a cheerful assistant. Please speak in a friendly manner.',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: { type: 'server_vad' },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Session data:', data);
    res.json({ client_secret: data.client_secret.value });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/messages', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).send('Text is required.');
    }

    console.log('Received text message:', text);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4', // Adjust the model as needed
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const botResponse = data.choices[0]?.message?.content || 'No response';
    res.json({ response: botResponse });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});