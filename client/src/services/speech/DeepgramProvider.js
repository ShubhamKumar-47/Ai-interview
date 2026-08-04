import { STT_STATUS, STT_ERRORS } from './types.js';
import { sanitizeTranscript } from './smartMerge.js';

export class DeepgramProvider {
  constructor(config = {}) {
    this.config = {
      apiKey: config.apiKey || import.meta.env.VITE_DEEPGRAM_API_KEY || '',
      wsUrl: config.wsUrl || '',
      model: config.model || 'nova-2',
      language: config.language || 'en-US',
      silenceTimeoutMs: config.silenceTimeoutMs || 3000,
      ...config
    };

    this.socket = null;
    this.mediaRecorder = null;
    this.audioStream = null;
    this.isListening = false;
    this.isStarting = false;
    this.shouldAutoRestart = false;

    // Callbacks
    this.onPartialHandler = config.onPartial || (() => {});
    this.onFinalHandler = config.onFinal || (() => {});
    this.onErrorHandler = config.onError || (() => {});
    this.onStatusChangeHandler = config.onStatusChange || (() => {});
    this.onLatencyHandler = config.onLatency || (() => {});

    this.speechStartTime = 0;
  }

  isSupported() {
    return !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async start() {
    if (this.isListening || this.isStarting) return;

    this.isStarting = true;
    this.shouldAutoRestart = true;
    this.onStatusChangeHandler(STT_STATUS.CONNECTING);

    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const wsTargetUrl = this.config.wsUrl || 
        `wss://api.deepgram.com/v1/listen?model=${this.config.model}&language=${this.config.language}&punctuate=true&interim_results=true&endpointing=300`;

      const protocols = this.config.apiKey ? ['token', this.config.apiKey] : undefined;
      this.socket = new WebSocket(wsTargetUrl, protocols);

      this.socket.onopen = () => {
        console.log('[StreamingSTT] Deepgram WebSocket Connected');
        this.isListening = true;
        this.isStarting = false;
        this.onStatusChangeHandler(STT_STATUS.LISTENING);
        this.startAudioStreaming();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const now = performance.now();

          const channel = data.channel || data.results?.channels?.[0];
          const alternative = channel?.alternatives?.[0];

          if (alternative && alternative.transcript) {
            const transcript = alternative.transcript;
            const isFinal = data.is_final || data.speech_final;

            if (this.speechStartTime > 0) {
              const latencyMs = Math.round(now - this.speechStartTime);
              this.onLatencyHandler(latencyMs);
            }

            if (isFinal) {
              console.log('[StreamingSTT] Deepgram Final:', transcript);
              this.onFinalHandler(sanitizeTranscript(transcript, false));
              this.speechStartTime = 0;
            } else {
              console.log('[StreamingSTT] Deepgram Partial:', transcript);
              this.onPartialHandler(sanitizeTranscript(transcript, false));
            }
          }
        } catch (err) {
          console.warn('[StreamingSTT] Deepgram message parse error:', err);
        }
      };

      this.socket.onerror = (err) => {
        console.error('[StreamingSTT] Deepgram Socket error:', err);
        this.onErrorHandler(STT_ERRORS.NETWORK);
      };

      this.socket.onclose = () => {
        console.log('[StreamingSTT] Deepgram Socket closed');
        this.isListening = false;
        this.isStarting = false;
        this.stopAudioStreaming();

        if (this.shouldAutoRestart) {
          this.handleAutoRestart();
        } else {
          this.onStatusChangeHandler(STT_STATUS.IDLE);
        }
      };
    } catch (err) {
      this.isStarting = false;
      console.error('[StreamingSTT] Deepgram start failed:', err);
      this.onStatusChangeHandler(STT_STATUS.ERROR);
      this.onErrorHandler(STT_ERRORS.PERMISSION_DENIED);
    }
  }

  startAudioStreaming() {
    if (!this.audioStream) return;

    this.mediaRecorder = new MediaRecorder(this.audioStream, { mimeType: 'audio/webm' });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.socket && this.socket.readyState === WebSocket.OPEN) {
        if (!this.speechStartTime) {
          this.speechStartTime = performance.now();
        }
        this.socket.send(event.data);
      }
    };
    // Send 100ms audio chunks for ultra-low latency streaming
    this.mediaRecorder.start(100);
  }

  stopAudioStreaming() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (err) {
        console.warn('[StreamingSTT] mediaRecorder.stop() exception:', err);
      }
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
  }

  handleAutoRestart() {
    if (!this.shouldAutoRestart || this.isStarting) return;
    setTimeout(() => {
      if (this.shouldAutoRestart && !this.isListening) {
        this.start();
      }
    }, 500);
  }

  stop() {
    this.shouldAutoRestart = false;
    this.stopAudioStreaming();
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    this.isListening = false;
    this.isStarting = false;
  }

  abort() {
    this.stop();
  }

  destroy() {
    this.stop();
  }
}
