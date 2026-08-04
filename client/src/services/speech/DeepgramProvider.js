import { STT_STATUS, STT_ERRORS } from './types.js';
import { sanitizeTranscript } from './smartMerge.js';
import { AudioWorkletPCMPipeline } from './audioWorkletPCM.js';

export class DeepgramProvider {
  constructor(config = {}) {
    this.config = {
      apiKey: config.apiKey || import.meta.env.VITE_DEEPGRAM_API_KEY || '',
      wsUrl: config.wsUrl || '',
      model: config.model || 'nova-2',
      language: config.language || 'en-US',
      ...config
    };

    this.socket = null;
    this.pcmPipeline = null;
    this.isListening = false;
    this.isStarting = false;
    this.shouldAutoRestart = false;

    // Callbacks
    this.onPartialHandler = config.onPartial || (() => {});
    this.onFinalHandler = config.onFinal || (() => {});
    this.onErrorHandler = config.onError || (() => {});
    this.onStatusChangeHandler = config.onStatusChange || (() => {});
    this.onLatencyHandler = config.onLatency || (() => {});

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
    this.onStatusChangeHandler(STT_STATUS.CONNECTING);

    try {
      const wsTargetUrl = this.config.wsUrl || 
        `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&model=${this.config.model}&language=${this.config.language}&punctuate=true&interim_results=true&endpointing=100&utterance_end_ms=1000&smart_format=false`;

      const protocols = this.config.apiKey ? ['token', this.config.apiKey] : undefined;
      this.socket = new WebSocket(wsTargetUrl, protocols);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = async () => {
        console.log('[StreamingSTT] Deepgram WebSocket Connected');
        this.isListening = true;
        this.isStarting = false;
        this.onStatusChangeHandler(STT_STATUS.LISTENING);

        // Start AudioWorklet PCM Pipeline (16kHz 20ms chunks)
        this.pcmPipeline = new AudioWorkletPCMPipeline((chunkBuffer) => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const now = Date.now();
            if (!this.timestamps.speechStart) {
              this.timestamps.speechStart = now;
            }
            if (!this.timestamps.firstChunk) {
              this.timestamps.firstChunk = now;
            }
            this.socket.send(chunkBuffer);
          }
        });

        await this.pcmPipeline.start();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const responseTime = Date.now();

          const channel = data.channel || data.results?.channels?.[0];
          const alternative = channel?.alternatives?.[0];

          if (alternative && alternative.transcript) {
            const rawTranscript = alternative.transcript;
            const isFinal = data.is_final || data.speech_final;

            if (!this.timestamps.providerResponse) {
              this.timestamps.providerResponse = responseTime;
            }
            this.timestamps.partialTranscript = Date.now();

            const totalLatency = this.timestamps.speechStart ? (this.timestamps.partialTranscript - this.timestamps.speechStart) : 0;

            console.log(`[StreamingSTT]\nSpeech Start: ${this.formatTimestamp(this.timestamps.speechStart)}\nFirst Chunk: ${this.formatTimestamp(this.timestamps.firstChunk)}\nProvider Response: ${this.formatTimestamp(this.timestamps.providerResponse)}\nPartial Transcript: ${this.formatTimestamp(this.timestamps.partialTranscript)}\nTotal Latency: ${totalLatency}ms`);

            this.onLatencyHandler(totalLatency);

            if (isFinal) {
              console.log('[StreamingSTT] Deepgram Final:', rawTranscript);
              this.onFinalHandler(sanitizeTranscript(rawTranscript, false));
              // Reset timestamps for next phrase
              this.timestamps.speechStart = 0;
              this.timestamps.firstChunk = 0;
              this.timestamps.providerResponse = 0;
            } else {
              console.log('[StreamingSTT] Deepgram Partial:', rawTranscript);
              this.onPartialHandler(sanitizeTranscript(rawTranscript, false));
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
        this.stopAudioPipeline();

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

  stopAudioPipeline() {
    if (this.pcmPipeline) {
      this.pcmPipeline.stop();
      this.pcmPipeline = null;
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
    this.stopAudioPipeline();
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
