import { STT_STATUS, STT_ERRORS } from './types.js';
import { sanitizeTranscript } from './smartMerge.js';
import { AudioWorkletPCMPipeline } from './audioWorkletPCM.js';

export class AssemblyAIProvider {
  constructor(config = {}) {
    this.config = {
      apiKey: config.apiKey || import.meta.env.VITE_ASSEMBLYAI_API_KEY || '',
      wsUrl: config.wsUrl || '',
      sampleRate: 16000,
      ...config
    };

    this.socket = null;
    this.pcmPipeline = null;
    this.isListening = false;
    this.isStarting = false;

    this.onPartialHandler = config.onPartial || (() => {});
    this.onFinalHandler = config.onFinal || (() => {});
    this.onErrorHandler = config.onError || (() => {});
    this.onStatusChangeHandler = config.onStatusChange || (() => {});
    this.onLatencyHandler = config.onLatency || (() => {});
  }

  isSupported() {
    return !!(this.config.apiKey || this.config.wsUrl) && !!(window.AudioContext || window.webkitAudioContext);
  }

  async start() {
    if (!this.isSupported()) {
      this.onErrorHandler(STT_ERRORS.NOT_SUPPORTED);
      return;
    }
    if (this.isListening || this.isStarting) return;

    this.isStarting = true;
    this.onStatusChangeHandler(STT_STATUS.CONNECTING);

    try {
      const wsUrl = this.config.wsUrl || `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=${this.config.sampleRate}`;
      const protocols = this.config.apiKey ? [this.config.apiKey] : undefined;

      this.socket = new WebSocket(wsUrl, protocols);

      this.socket.onopen = async () => {
        console.log('[StreamingSTT] AssemblyAI WebSocket Connected');
        this.isListening = true;
        this.isStarting = false;
        this.onStatusChangeHandler(STT_STATUS.LISTENING);

        this.pcmPipeline = new AudioWorkletPCMPipeline((chunkBuffer) => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            // AssemblyAI expects base64 encoded audio in JSON packet
            const base64Audio = btoa(String.fromCharCode(...new Uint8Array(chunkBuffer)));
            this.socket.send(JSON.stringify({ audio_data: base64Audio }));
          }
        });
        await this.pcmPipeline.start();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.message_type === 'PartialTranscript' && data.text) {
            this.onPartialHandler(sanitizeTranscript(data.text, false));
          } else if (data.message_type === 'FinalTranscript' && data.text) {
            this.onFinalHandler(sanitizeTranscript(data.text, false));
          }
        } catch (err) {
          console.warn('[StreamingSTT] AssemblyAI message parse error:', err);
        }
      };

      this.socket.onerror = () => {
        this.onErrorHandler(STT_ERRORS.NETWORK);
      };

      this.socket.onclose = () => {
        this.isListening = false;
        this.isStarting = false;
        this.stopAudioPipeline();
        this.onStatusChangeHandler(STT_STATUS.IDLE);
      };
    } catch (err) {
      console.error('[StreamingSTT] AssemblyAI start failed:', err);
      this.isStarting = false;
      this.onStatusChangeHandler(STT_STATUS.ERROR);
    }
  }

  stopAudioPipeline() {
    if (this.pcmPipeline) {
      this.pcmPipeline.stop();
      this.pcmPipeline = null;
    }
  }

  stop() {
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
