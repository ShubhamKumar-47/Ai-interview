import { STT_STATUS, STT_ERRORS } from './types.js';
import { sanitizeTranscript } from './smartMerge.js';
import { AudioWorkletPCMPipeline } from './audioWorkletPCM.js';
import { ServerUrl } from '../../config.js';

export class DeepgramProvider {
  constructor(config = {}) {
    // Convert Server HTTP URL (e.g. http://localhost:8000 or https://api.mockverse.online) to WS URL (ws://... or wss://...)
    const defaultWsProxy = ServerUrl.replace(/^http/, 'ws') + '/api/speech/stream';

    this.config = {
      wsUrl: config.wsUrl || import.meta.env.VITE_DEEPGRAM_WS_URL || defaultWsProxy,
      model: config.model || 'nova-2',
      language: config.language || 'en-US',
      maxRetries: 3,
      ...config
    };

    this.socket = null;
    this.pcmPipeline = null;
    this.isListening = false;
    this.isStarting = false;
    this.isAuthenticated = false;
    this.shouldAutoRestart = false;

    // Retry & exponential backoff tracking
    this.retryCount = 0;
    this.retryTimer = null;
    this.hasLoggedSendingPCM = false;

    // Callbacks
    this.onPartialHandler = config.onPartial || (() => {});
    this.onFinalHandler = config.onFinal || (() => {});
    this.onErrorHandler = config.onError || (() => {});
    this.onStatusChangeHandler = config.onStatusChange || (() => {});
    this.onLatencyHandler = config.onLatency || (() => {});
    this.onFallbackRequiredHandler = config.onFallbackRequired || (() => {});

    // Detailed Latency Instrumentation Timestamps
    this.timestamps = {
      speechStart: 0,
      firstChunk: 0,
      providerResponse: 0,
      partialTranscript: 0
    };
  }

  isSupported() {
    return !!(window.AudioContext || window.webkitAudioContext) && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  formatTimestamp(ts) {
    if (!ts) return 'N/A';
    const date = new Date(ts);
    const timeStr = date.toTimeString().split(' ')[0];
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${timeStr}.${ms}`;
  }

  async start() {
    if (this.isListening || this.isStarting) return;

    this.isStarting = true;
    this.shouldAutoRestart = true;
    this.hasLoggedSendingPCM = false;
    console.log('[StreamingSTT] Connecting');
    this.onStatusChangeHandler(STT_STATUS.CONNECTING);

    try {
      this.socket = new WebSocket(this.config.wsUrl);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = () => {
        console.log('[StreamingSTT] Socket Open');
      };

      this.socket.onmessage = async (event) => {
        try {
          // Check for control JSON frames or transcript frames
          if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);

            if (data.type === 'authenticated' || data.status === 'authenticated') {
              console.log('[StreamingSTT] Authenticated');
              this.isAuthenticated = true;
              this.isListening = true;
              this.isStarting = false;
              this.retryCount = 0; // Reset backoff counter on successful auth
              this.onStatusChangeHandler(STT_STATUS.LISTENING);

              // Start AudioWorklet PCM Pipeline strictly AFTER socket is OPEN & Authenticated
              await this.startAudioPipeline();
              return;
            }

            if (data.type === 'error' && (data.code === 'NO_KEY' || data.code === 'DEEPGRAM_ERROR')) {
              console.warn(`[StreamingSTT] Deepgram Proxy Error: ${data.message}`);
              this.handleFallback();
              return;
            }

            const channel = data.channel || data.results?.channels?.[0];
            const alternative = channel?.alternatives?.[0];

            if (alternative && alternative.transcript) {
              const rawTranscript = alternative.transcript;
              const isFinal = data.is_final || data.speech_final;

              const responseTime = Date.now();
              if (!this.timestamps.providerResponse) {
                this.timestamps.providerResponse = responseTime;
                console.log('[StreamingSTT] Receiving Transcript');
              }
              this.timestamps.partialTranscript = Date.now();

              const totalLatency = this.timestamps.speechStart ? (this.timestamps.partialTranscript - this.timestamps.speechStart) : 0;

              console.log(`[StreamingSTT]\nSpeech Start: ${this.formatTimestamp(this.timestamps.speechStart)}\nFirst Chunk: ${this.formatTimestamp(this.timestamps.firstChunk)}\nProvider Response: ${this.formatTimestamp(this.timestamps.providerResponse)}\nPartial Transcript: ${this.formatTimestamp(this.timestamps.partialTranscript)}\nTotal Latency: ${totalLatency}ms`);

              this.onLatencyHandler(totalLatency);

              if (isFinal) {
                console.log('[StreamingSTT] Deepgram Final:', rawTranscript);
                this.onFinalHandler(sanitizeTranscript(rawTranscript, false));
                this.timestamps.speechStart = 0;
                this.timestamps.firstChunk = 0;
                this.timestamps.providerResponse = 0;
              } else {
                console.log('[StreamingSTT] Deepgram Partial:', rawTranscript);
                this.onPartialHandler(sanitizeTranscript(rawTranscript, false));
              }
            }
          }
        } catch (err) {
          console.warn('[StreamingSTT] Message parse warning:', err);
        }
      };

      this.socket.onerror = (err) => {
        console.error('[StreamingSTT] Socket error:', err);
        this.onErrorHandler(STT_ERRORS.NETWORK);
      };

      this.socket.onclose = (event) => {
        console.log(`[StreamingSTT] Socket Closed (Code: ${event.code})`);
        this.isListening = false;
        this.isStarting = false;
        this.isAuthenticated = false;
        this.stopAudioPipeline();

        if (event.code === 4001 || event.code === 4002) {
          console.warn('[StreamingSTT] Server denied connection or missing key. Triggering fallback.');
          this.handleFallback();
          return;
        }

        if (this.shouldAutoRestart) {
          this.scheduleReconnect();
        } else {
          this.onStatusChangeHandler(STT_STATUS.IDLE);
        }
      };
    } catch (err) {
      this.isStarting = false;
      console.error('[StreamingSTT] Connection setup failed:', err);
      this.scheduleReconnect();
    }
  }

  async startAudioPipeline() {
    if (this.pcmPipeline) return;

    this.pcmPipeline = new AudioWorkletPCMPipeline((chunkBuffer) => {
      // STRICT GUARD: Never send audio unless WebSocket is OPEN and Authenticated
      if (this.socket && this.socket.readyState === WebSocket.OPEN && this.isAuthenticated) {
        const now = Date.now();
        if (!this.timestamps.speechStart) {
          this.timestamps.speechStart = now;
        }
        if (!this.timestamps.firstChunk) {
          this.timestamps.firstChunk = now;
        }
        if (!this.hasLoggedSendingPCM) {
          console.log('[StreamingSTT] Sending PCM');
          this.hasLoggedSendingPCM = true;
        }
        this.socket.send(chunkBuffer);
      }
    });

    await this.pcmPipeline.start();
  }

  stopAudioPipeline() {
    if (this.pcmPipeline) {
      this.pcmPipeline.stop();
      this.pcmPipeline = null;
    }
  }

  scheduleReconnect() {
    if (!this.shouldAutoRestart) return;

    this.retryCount++;
    if (this.retryCount > this.config.maxRetries) {
      console.warn(`[StreamingSTT] Reached max reconnect attempts (${this.config.maxRetries}). Initiating provider fallback.`);
      this.handleFallback();
      return;
    }

    // Exponential Backoff: 1s, 2s, 4s, 8s, max 30s
    const backoffMs = Math.min(30000, Math.pow(2, this.retryCount - 1) * 1000);
    console.log(`[StreamingSTT] Reconnect (attempt ${this.retryCount}/${this.config.maxRetries}, backoff ${backoffMs / 1000}s)`);

    if (this.retryTimer) clearTimeout(this.retryTimer);

    this.retryTimer = setTimeout(() => {
      if (this.shouldAutoRestart && !this.isListening && !this.isStarting) {
        this.start();
      }
    }, backoffMs);
  }

  handleFallback() {
    this.stop();
    if (this.onFallbackRequiredHandler) {
      console.log('[StreamingSTT] Falling back to next available provider in hierarchy...');
      this.onFallbackRequiredHandler();
    }
  }

  stop() {
    this.shouldAutoRestart = false;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.stopAudioPipeline();
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      this.socket.close();
    }
    this.socket = null;
    this.isListening = false;
    this.isStarting = false;
    this.isAuthenticated = false;
  }

  abort() {
    this.stop();
  }

  destroy() {
    this.stop();
  }
}
