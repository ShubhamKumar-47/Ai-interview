import { STT_STATUS, STT_ERRORS } from './types.js';
import { sanitizeTranscript } from './smartMerge.js';
import { AudioWorkletPCMPipeline } from './audioWorkletPCM.js';

export class GoogleStreamingProvider {
  constructor(config = {}) {
    this.config = {
      wsUrl: config.wsUrl || import.meta.env.VITE_GOOGLE_STT_WS_URL || '',
      language: config.language || 'en-US',
      ...config
    };

    this.socket = null;
    this.pcmPipeline = null;
    this.isListening = false;
    this.isStarting = false;
    this.shouldAutoRestart = false;

    this.onPartialHandler = config.onPartial || (() => {});
    this.onFinalHandler = config.onFinal || (() => {});
    this.onErrorHandler = config.onError || (() => {});
    this.onStatusChangeHandler = config.onStatusChange || (() => {});
    this.onLatencyHandler = config.onLatency || (() => {});
  }

  isSupported() {
    return !!this.config.wsUrl && !!(window.AudioContext || window.webkitAudioContext);
  }

  async start() {
    if (!this.isSupported()) {
      this.onErrorHandler(STT_ERRORS.NOT_SUPPORTED);
      return;
    }
    if (this.isListening || this.isStarting) return;

    this.isStarting = true;
    this.shouldAutoRestart = true;
    this.onStatusChangeHandler(STT_STATUS.CONNECTING);

    try {
      this.socket = new WebSocket(this.config.wsUrl);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = async () => {
        console.log('[StreamingSTT] Google Streaming STT WebSocket Connected');
        this.isListening = true;
        this.isStarting = false;
        this.onStatusChangeHandler(STT_STATUS.LISTENING);

        this.pcmPipeline = new AudioWorkletPCMPipeline((chunkBuffer) => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(chunkBuffer);
          }
        });
        await this.pcmPipeline.start();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const transcript = data.results?.[0]?.alternatives?.[0]?.transcript;
          const isFinal = data.results?.[0]?.isFinal;

          if (transcript) {
            if (isFinal) {
              this.onFinalHandler(sanitizeTranscript(transcript, false));
            } else {
              this.onPartialHandler(sanitizeTranscript(transcript, false));
            }
          }
        } catch (err) {
          console.warn('[StreamingSTT] Google STT parse error:', err);
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
      console.error('[StreamingSTT] Google STT start failed:', err);
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
