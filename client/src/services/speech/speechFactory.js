import { STT_PROVIDERS } from './types.js';
import { WebSpeechProvider } from './WebSpeechProvider.js';
import { DeepgramProvider } from './DeepgramProvider.js';
import { GoogleStreamingProvider } from './GoogleStreamingProvider.js';
import { AssemblyAIProvider } from './AssemblyAIProvider.js';
import { WhisperLiveProvider } from './WhisperLiveProvider.js';

// Global registry of failed providers in the current session so they are NEVER retried
const failedProviders = new Set();

export function markProviderFailed(providerType) {
  if (providerType && providerType !== STT_PROVIDERS.WEB_SPEECH) {
    console.warn(`[StreamingSTT] Provider status: FAILED (${providerType}). Removing from active hierarchy.`);
    failedProviders.add(providerType);
  }
}

export function isProviderFailed(providerType) {
  return failedProviders.has(providerType);
}

/**
 * Resolves next available STT provider according to strict priority:
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

  // Filter out any providers marked as FAILED in this session
  const activeCandidates = providerList.filter((p) => !failedProviders.has(p.type));

  // Determine starting index based on preferredProvider
  let startIndex = activeCandidates.findIndex((p) => p.type === preferredProvider);
  if (startIndex === -1) {
    startIndex = 0;
  }

  for (let i = startIndex; i < activeCandidates.length; i++) {
    const entry = activeCandidates[i];

    // Startup Validation for Deepgram: check if client key is configured
    if (entry.type === STT_PROVIDERS.DEEPGRAM) {
      const hasClientKey = !!(options.apiKey || import.meta.env.VITE_DEEPGRAM_API_KEY || options.wsUrl);
      const isServerDisabled = options.isDeepgramDisabled;

      if (!hasClientKey && isServerDisabled) {
        console.log('Deepgram disabled: Missing API key');
        console.log('[StreamingSTT] Skipping Deepgram. Switching to next provider in hierarchy...');
        failedProviders.add(STT_PROVIDERS.DEEPGRAM);
        continue;
      }
    }

    const instance = new entry.class({
      ...options,
      onFallbackRequired: () => {
        markProviderFailed(entry.type);
        if (options.onFallbackRequired) {
          options.onFallbackRequired(entry.type);
        }
      }
    });

    if (instance.isSupported()) {
      console.log(`[StreamingSTT] Initializing provider: ${entry.type}`);
      return instance;
    } else {
      console.warn(`[StreamingSTT] Provider ${entry.type} not supported by environment.`);
      failedProviders.add(entry.type);
    }
  }

  // Final guaranteed fallback
  console.log('[StreamingSTT] Fallback Provider Initializing: browser_webspeech');
  return new WebSpeechProvider(options);
}
