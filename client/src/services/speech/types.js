/**
 * Streaming STT Provider Types & Enums
 */

export const STT_PROVIDERS = {
  WEB_SPEECH: 'web_speech',
  DEEPGRAM: 'deepgram',
  ASSEMBLY_AI: 'assembly_ai',
  GOOGLE_CLOUD: 'google_cloud',
  WHISPER_LIVE: 'whisper_live'
};

export const STT_STATUS = {
  IDLE: 'Idle',
  CONNECTING: 'Connecting',
  LISTENING: 'Listening',
  PROCESSING: 'Processing',
  RECONNECTING: 'Reconnecting',
  ERROR: 'Error',
  PERMISSION_DENIED: 'Permission Denied'
};

export const STT_ERRORS = {
  NOT_ALLOWED: 'not-allowed',
  NO_SPEECH: 'no-speech',
  AUDIO_CAPTURE: 'audio-capture',
  ABORTED: 'aborted',
  NETWORK: 'network',
  SERVICE_NOT_ALLOWED: 'service-not-allowed',
  NOT_SUPPORTED: 'not-supported',
  UNKNOWN: 'unknown'
};
