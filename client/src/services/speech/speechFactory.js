import { STT_PROVIDERS } from './types.js';
import { WebSpeechProvider } from './WebSpeechProvider.js';
import { DeepgramProvider } from './DeepgramProvider.js';
import { GoogleStreamingProvider } from './GoogleStreamingProvider.js';
import { AssemblyAIProvider } from './AssemblyAIProvider.js';
import { WhisperLiveProvider } from './WhisperLiveProvider.js';

/**
 * Creates and initializes an STT provider instance based on exact configured priority hierarchy:
 * 1. Deepgram Streaming API
 * 2. Google Cloud Streaming STT
 * 3. AssemblyAI Realtime
 * 4. Whisper Live
 * 5. Browser Web Speech API (Fallback)
 */
export function createSpeechProvider(preferredProvider = STT_PROVIDERS.DEEPGRAM, options = {}) {
  const providerList = [
    { type: STT_PROVIDERS.DEEPGRAM, class: DeepgramProvider },
    { type: STT_PROVIDERS.GOOGLE_CLOUD, class: GoogleStreamingProvider },
    { type: STT_PROVIDERS.ASSEMBLY_AI, class: AssemblyAIProvider },
    { type: STT_PROVIDERS.WHISPER_LIVE, class: WhisperLiveProvider },
    { type: STT_PROVIDERS.WEB_SPEECH, class: WebSpeechProvider }
  ];

  // If a specific provider was requested, try it first
  if (preferredProvider) {
    const requested = providerList.find((p) => p.type === preferredProvider);
    if (requested) {
      const instance = new requested.class(options);
      if (instance.isSupported()) {
        console.log(`[StreamingSTT] Initialized Preferred STT Provider: ${preferredProvider}`);
        return instance;
      }
      console.warn(`[StreamingSTT] Preferred STT Provider (${preferredProvider}) not supported/configured. Falling back.`);
    }
  }

  // Iterate down the priority chain
  for (const entry of providerList) {
    const instance = new entry.class(options);
    if (instance.isSupported()) {
      console.log(`[StreamingSTT] Initialized Active STT Provider: ${entry.type}`);
      return instance;
    }
  }

  // Final fallback: WebSpeech
  console.log('[StreamingSTT] Initialized Fallback WebSpeech STT Provider');
  return new WebSpeechProvider(options);
}
