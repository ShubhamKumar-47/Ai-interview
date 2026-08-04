import { WebSocketServer, WebSocket } from 'ws';

/**
 * Express WebSocket Proxy for Deepgram Live API
 * Securely proxies browser WebSockets to Deepgram without exposing API keys to client.
 */
export function setupSpeechProxy(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);

    if (pathname === '/api/speech/stream') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (clientSocket, req) => {
    console.log('🔌 [SpeechProxy] Client connected to speech proxy');

    const deepgramKey = process.env.DEEPGRAM_API_KEY;

    if (!deepgramKey) {
      console.warn('⚠️ [SpeechProxy] DEEPGRAM_API_KEY missing in server env');
      clientSocket.send(JSON.stringify({
        type: 'error',
        code: 'NO_KEY',
        message: 'DEEPGRAM_API_KEY missing on backend server'
      }));
      clientSocket.close(4001, 'DEEPGRAM_API_KEY missing');
      return;
    }

    const deepgramUrl = 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&model=nova-2&language=en-US&punctuate=true&interim_results=true&endpointing=100&utterance_end_ms=1000&smart_format=false';

    let dgSocket = null;

    try {
      dgSocket = new WebSocket(deepgramUrl, {
        headers: {
          Authorization: `Token ${deepgramKey}`
        }
      });
    } catch (err) {
      console.error('❌ [SpeechProxy] Failed to instantiate Deepgram WebSocket:', err);
      clientSocket.close(4002, 'Deepgram Connection Error');
      return;
    }

    dgSocket.on('open', () => {
      console.log('✅ [SpeechProxy] Connected to Deepgram Live API (Authenticated)');
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({
          type: 'authenticated',
          status: 'authenticated'
        }));
      }
    });

    // Client -> Deepgram Audio Streaming (16kHz PCM binary chunks)
    clientSocket.on('message', (message, isBinary) => {
      if (dgSocket && dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.send(message, { binary: isBinary });
      }
    });

    // Deepgram -> Client Transcript Events
    dgSocket.on('message', (data) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(data.toString());
      }
    });

    dgSocket.on('error', (err) => {
      console.error('❌ [SpeechProxy] Deepgram socket error:', err.message);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({
          type: 'error',
          code: 'DEEPGRAM_ERROR',
          message: err.message
        }));
      }
    });

    dgSocket.on('close', (code, reason) => {
      console.log(`🔌 [SpeechProxy] Deepgram socket closed (${code}) ${reason}`);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(1000, 'Deepgram closed connection');
      }
    });

    clientSocket.on('close', () => {
      console.log('🔌 [SpeechProxy] Client disconnected from speech proxy');
      if (dgSocket && (dgSocket.readyState === WebSocket.OPEN || dgSocket.readyState === WebSocket.CONNECTING)) {
        dgSocket.close();
      }
    });

    clientSocket.on('error', (err) => {
      console.error('❌ [SpeechProxy] Client socket error:', err.message);
      if (dgSocket) {
        dgSocket.close();
      }
    });
  });

  console.log('🚀 [SpeechProxy] WebSocket proxy initialized on /api/speech/stream');
}
