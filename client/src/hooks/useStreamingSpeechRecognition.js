import { useState, useEffect, useRef, useCallback } from 'react';
import { createSpeechProvider } from '../services/speech/speechFactory.js';
import { STT_PROVIDERS, STT_STATUS, STT_ERRORS } from '../services/speech/types.js';
import { combineFinalAndPartial, sanitizeTranscript } from '../services/speech/smartMerge.js';

export function useStreamingSpeechRecognition(options = {}) {
  const {
    provider = STT_PROVIDERS.WEB_SPEECH,
    lang = 'en-US',
    silenceTimeoutMs = 3000,
    autoStart = false,
    onTranscriptChange = null
  } = options;

  // Reactive state
  const [isListening, setIsListening] = useState(false);
  const [micStatus, setMicStatus] = useState(STT_STATUS.IDLE);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [combinedTranscript, setCombinedTranscript] = useState('');
  const [latencyMs, setLatencyMs] = useState(0);
  const [error, setError] = useState(null);

  // Sync refs to avoid stale closures & unnecessary re-renders
  const providerRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const partialTranscriptRef = useRef('');
  const isListeningRef = useRef(false);
  const pausedRef = useRef(false);

  // Audio Context & Level monitoring for mic visualizer
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Audio level monitoring helper
  const startAudioAnalyzer = useCallback(async () => {
    try {
      if (mediaStreamRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn('[StreamingSTT] Audio visualizer analyzer start failed:', err);
    }
  }, []);

  const stopAudioAnalyzer = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Updates and merges transcripts safely
  const updateCombinedTranscript = useCallback((newFinal, newPartial) => {
    const merged = combineFinalAndPartial(newFinal, newPartial);
    setCombinedTranscript(merged);
    if (onTranscriptChange) {
      onTranscriptChange(merged);
    }
  }, [onTranscriptChange]);

  // Provider callback handlers
  const handlePartial = useCallback((partialText) => {
    if (pausedRef.current) return;
    partialTranscriptRef.current = partialText;
    setPartialTranscript(partialText);
    updateCombinedTranscript(finalTranscriptRef.current, partialText);
  }, [updateCombinedTranscript]);

  const handleFinal = useCallback((finalSegment) => {
    if (pausedRef.current || !finalSegment) return;
    const updatedFinal = combineFinalAndPartial(finalTranscriptRef.current, finalSegment);
    finalTranscriptRef.current = updatedFinal;
    partialTranscriptRef.current = '';

    setFinalTranscript(updatedFinal);
    setPartialTranscript('');
    updateCombinedTranscript(updatedFinal, '');
  }, [updateCombinedTranscript]);

  const handleStatusChange = useCallback((status) => {
    console.log(`[StreamingSTT] Status updated to: ${status}`);
    setMicStatus(status);
    const listeningState = status === STT_STATUS.LISTENING;
    setIsListening(listeningState);
    isListeningRef.current = listeningState;

    if (listeningState) {
      startAudioAnalyzer();
    } else if (status === STT_STATUS.IDLE || status === STT_STATUS.ERROR || status === STT_STATUS.PERMISSION_DENIED) {
      stopAudioAnalyzer();
    }
  }, [startAudioAnalyzer, stopAudioAnalyzer]);

  const handleError = useCallback((errCode) => {
    console.error(`[StreamingSTT] Error event: ${errCode}`);
    setError(errCode);
    if (errCode === STT_ERRORS.NOT_ALLOWED) {
      setMicStatus(STT_STATUS.PERMISSION_DENIED);
    }
  }, []);

  const handleLatency = useCallback((latency) => {
    setLatencyMs(latency);
  }, []);

  // Initialize Speech Provider
  useEffect(() => {
    const instance = createSpeechProvider(provider, {
      lang,
      silenceTimeoutMs,
      onPartial: handlePartial,
      onFinal: handleFinal,
      onStatusChange: handleStatusChange,
      onError: handleError,
      onLatency: handleLatency
    });

    providerRef.current = instance;

    if (autoStart) {
      instance.start();
    }

    return () => {
      stopAudioAnalyzer();
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
    };
  }, [provider, lang, silenceTimeoutMs, autoStart, handlePartial, handleFinal, handleStatusChange, handleError, handleLatency, stopAudioAnalyzer]);

  // Controls API
  const start = useCallback(() => {
    pausedRef.current = false;
    if (providerRef.current) {
      providerRef.current.start();
    }
  }, []);

  const stop = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.stop();
    }
    stopAudioAnalyzer();
  }, [stopAudioAnalyzer]);

  const abort = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.abort();
    }
    stopAudioAnalyzer();
  }, [stopAudioAnalyzer]);

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
  }, []);

  const restart = useCallback(() => {
    console.log('[StreamingSTT] Explicit restart requested');
    if (providerRef.current) {
      providerRef.current.abort();
      setTimeout(() => {
        if (providerRef.current) {
          providerRef.current.start();
        }
      }, 200);
    }
  }, []);

  const resetTranscript = useCallback((initialText = '') => {
    const cleaned = sanitizeTranscript(initialText, false);
    finalTranscriptRef.current = cleaned;
    partialTranscriptRef.current = '';
    setFinalTranscript(cleaned);
    setPartialTranscript('');
    setCombinedTranscript(cleaned);
  }, []);

  return {
    isListening,
    micStatus,
    partialTranscript,
    finalTranscript,
    combinedTranscript,
    audioLevel,
    latencyMs,
    error,
    start,
    stop,
    abort,
    pause,
    resume,
    restart,
    resetTranscript
  };
}
