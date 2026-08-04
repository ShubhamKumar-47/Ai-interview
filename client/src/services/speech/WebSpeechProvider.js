import { STT_STATUS, STT_ERRORS } from './types.js';
import { sanitizeTranscript } from './smartMerge.js';

export class WebSpeechProvider {
  constructor(config = {}) {
    this.config = {
      lang: config.lang || 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      silenceTimeoutMs: config.silenceTimeoutMs || 3000,
      ...config
    };

    this.recognition = null;
    this.isListening = false;
    this.isStarting = false;
    this.isStopping = false;
    this.shouldAutoRestart = false;

    // Callbacks
    this.onPartialHandler = config.onPartial || (() => {});
    this.onFinalHandler = config.onFinal || (() => {});
    this.onErrorHandler = config.onError || (() => {});
    this.onStatusChangeHandler = config.onStatusChange || (() => {});
    this.onLatencyHandler = config.onLatency || (() => {});

    // Silence detection & latency tracking
    this.speechStartTime = 0;
    this.lastSpeechTime = Date.now();
    this.silenceTimer = null;

    this.initRecognition();
  }

  isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  initRecognition() {
    if (!this.isSupported()) {
      console.warn('[StreamingSTT] Web Speech API is not supported in this browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.config.lang;
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.maxAlternatives = this.config.maxAlternatives;

    this.setupListeners();
  }

  setupListeners() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.isStarting = false;
      this.isStopping = false;
      this.lastSpeechTime = Date.now();
      console.log('[StreamingSTT] Recognition started');
      this.onStatusChangeHandler(STT_STATUS.LISTENING);
      this.resetSilenceTimer();
    };

    this.recognition.onsoundstart = () => {
      this.speechStartTime = performance.now();
      this.lastSpeechTime = Date.now();
      this.resetSilenceTimer();
    };

    this.recognition.onspeechstart = () => {
      if (!this.speechStartTime) {
        this.speechStartTime = performance.now();
      }
      this.lastSpeechTime = Date.now();
      this.resetSilenceTimer();
    };

    this.recognition.onresult = (event) => {
      const now = performance.now();
      this.lastSpeechTime = Date.now();
      this.resetSilenceTimer();

      let interimTranscript = '';
      let finalTranscriptSegment = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';

        if (result.isFinal) {
          finalTranscriptSegment += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (this.speechStartTime > 0) {
        const latencyMs = Math.round(now - this.speechStartTime);
        console.log(`[StreamingSTT] Latency: ${latencyMs}ms`);
        this.onLatencyHandler(latencyMs);
      }

      if (interimTranscript) {
        const cleanedInterim = sanitizeTranscript(interimTranscript, false);
        console.log('[StreamingSTT] Partial transcript:', cleanedInterim);
        this.onPartialHandler(cleanedInterim);
      }

      if (finalTranscriptSegment) {
        const cleanedFinal = sanitizeTranscript(finalTranscriptSegment, false);
        console.log('[StreamingSTT] Final transcript segment:', cleanedFinal);
        this.onFinalHandler(cleanedFinal);
        // Reset speech start time for next phrase latency measurement
        this.speechStartTime = 0;
      }
    };

    this.recognition.onerror = (event) => {
      const errorMsg = event.error || STT_ERRORS.UNKNOWN;
      console.error('[StreamingSTT] Recognition error:', errorMsg);

      if (errorMsg === 'aborted') {
        // Intentionally aborted or stopped
        this.isListening = false;
        this.isStarting = false;
        return;
      }

      if (errorMsg === 'no-speech') {
        // Normal silence from user speaking - keep recognition alive continuously without stopping
        console.log('[StreamingSTT] Silence observed - keeping recognition session active');
        return;
      }

      if (errorMsg === 'not-allowed' || errorMsg === 'service-not-allowed') {
        this.shouldAutoRestart = false;
        this.onStatusChangeHandler(STT_STATUS.PERMISSION_DENIED);
        this.onErrorHandler(STT_ERRORS.NOT_ALLOWED);
        return;
      }

      this.onErrorHandler(errorMsg);
      this.handleAutoRestart();
    };

    this.recognition.onend = () => {
      console.log('[StreamingSTT] Recognition ended');
      this.isListening = false;
      this.isStarting = false;
      this.clearSilenceTimer();

      if (this.shouldAutoRestart && !this.isStopping) {
        console.log('[StreamingSTT] Restart triggered');
        this.handleAutoRestart();
      } else {
        this.onStatusChangeHandler(STT_STATUS.IDLE);
      }
    };
  }

  resetSilenceTimer() {
    this.clearSilenceTimer();
    if (!this.config.silenceTimeoutMs) return;

    this.silenceTimer = setTimeout(() => {
      const silenceDuration = Date.now() - this.lastSpeechTime;
      if (silenceDuration >= this.config.silenceTimeoutMs && this.isListening) {
        console.log(`[StreamingSTT] Silence timeout reached (${silenceDuration}ms)`);
        // Signal silence reached if needed without stopping abruptly
      }
    }, this.config.silenceTimeoutMs);
  }

  clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  handleAutoRestart() {
    if (!this.shouldAutoRestart || this.isStopping || this.isStarting) return;

    setTimeout(() => {
      if (this.shouldAutoRestart && !this.isListening && !this.isStarting) {
        this.start();
      }
    }, 200);
  }

  start() {
    if (!this.recognition) {
      this.onStatusChangeHandler(STT_STATUS.ERROR);
      this.onErrorHandler(STT_ERRORS.NOT_SUPPORTED);
      return;
    }

    if (this.isListening || this.isStarting) {
      console.warn('[StreamingSTT] Recognition already running or starting. Prevented duplicate instance.');
      return;
    }

    try {
      this.shouldAutoRestart = true;
      this.isStarting = true;
      this.onStatusChangeHandler(STT_STATUS.CONNECTING);
      this.recognition.start();
    } catch (err) {
      this.isStarting = false;
      console.error('[StreamingSTT] Start failed:', err);
      if (err.name === 'InvalidStateError') {
        console.warn('[StreamingSTT] InvalidStateError caught. Re-initializing instance.');
        this.handleAutoRestart();
      } else {
        this.onStatusChangeHandler(STT_STATUS.ERROR);
        this.onErrorHandler(err.message);
      }
    }
  }

  stop() {
    this.shouldAutoRestart = false;
    this.isStopping = true;
    this.clearSilenceTimer();

    if (this.recognition && (this.isListening || this.isStarting)) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('[StreamingSTT] Stop call warning:', err);
      }
    }
    this.isListening = false;
    this.isStarting = false;
  }

  abort() {
    this.shouldAutoRestart = false;
    this.isStopping = true;
    this.clearSilenceTimer();

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (err) {
        console.warn('[StreamingSTT] Abort call warning:', err);
      }
    }
    this.isListening = false;
    this.isStarting = false;
    this.onStatusChangeHandler(STT_STATUS.IDLE);
  }

  destroy() {
    this.abort();
    if (this.recognition) {
      this.recognition.onstart = null;
      this.recognition.onsoundstart = null;
      this.recognition.onspeechstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition = null;
    }
  }
}
