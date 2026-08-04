import { STT_PROVIDERS } from './types.js';
import { WebSpeechProvider } from './WebSpeechProvider.js';
import { DeepgramProvider } from './DeepgramProvider.js';

/**
 * Creates and initializes an STT provider instance based on configured priority and environment capabilities.
 */
export function createSpeechProvider(preferredProvider = STT_PROVIDERS.WEB_SPEECH, options = {}) {
  const deepgramKey = import.meta.env.VITE_DEEPGRAM_API_KEY || options.deepgramApiKey;

  // 1. If Deepgram requested or API key available, instantiate DeepgramProvider
  if ((preferredProvider === STT_PROVIDERS.DEEPGRAM || deepgramKey) && preferredProvider !== STT_PROVIDERS.WEB_SPEECH) {
    const deepgram = new DeepgramProvider({ apiKey: deepgramKey, ...options });
    if (deepgram.isSupported()) {
      console.log('[StreamingSTT] Initialized Deepgram Streaming STT Provider');
      return deepgram;
    }
  }

  // 2. Default Fallback / Native: WebSpeechProvider
  const webSpeech = new WebSpeechProvider(options);
  console.log('[StreamingSTT] Initialized Native WebSpeech STT Provider');
  return webSpeech;
}
