import { STT_STATUS, STT_ERRORS } from './types.js';
import { sanitizeTranscript } from './smartMerge.js';
import { AudioWorkletPCMPipeline } from './audioWorkletPCM.js';

export class WhisperLiveProvider {
  constructor(config = {}) {
    this.config = {
      wsUrl: config.wsUrl || import.meta.env.VITE_WHISPER_LIVE_WS_URL || '',
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
    return !!this.config.wsUrl && !!(window.AudioContext || window.webkitAudioContext);
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
      this.socket = new WebSocket(this.config.wsUrl);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = async () => {
        console.log('[StreamingSTT] Whisper Live WebSocket Connected');
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
          if (data.segments && data.segments.length > 0) {
            const lastSegment = data.segments[data.segments.length - 1];
            if (lastSegment.completed) {
              this.onFinalHandler(sanitizeTranscript(lastSegment.text, false));
            } else {
              this.onPartialHandler(sanitizeTranscript(lastSegment.text, false));
            }
          }
        } catch (err) {
          console.warn('[StreamingSTT] Whisper Live parse error:', err);
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
      console.error('[StreamingSTT] Whisper Live start failed:', err);
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
