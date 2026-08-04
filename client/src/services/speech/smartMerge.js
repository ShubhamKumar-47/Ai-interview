/**
 * Smart Transcript Merge & Cleaning Utilities
 * Ensures seamless merging of interim/partial transcripts with final transcripts
 * without word duplication or stuttering.
 */

// Common spoken filler words to sanitize
const FILLER_WORDS_REGEX = /\b(uh|umm|hmm|er|ah)\b/gi;

/**
 * Clean duplicate whitespace and optional filler words
 */
export function sanitizeTranscript(text, removeFillers = true) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;
  if (removeFillers) {
    cleaned = cleaned.replace(FILLER_WORDS_REGEX, '');
  }
  // Replace consecutive duplicate words (e.g. "the the" -> "the")
  cleaned = cleaned.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1');
  // Collapse duplicate spaces
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Finds the maximum word-level overlap between end of textA and start of textB.
 * Example:
 * textA = "I am working on"
 * textB = "working on a React app"
 * overlap = "working on"
 * result = "I am working on a React app"
 */
export function mergeOverlappingText(textA, textB) {
  const normA = sanitizeTranscript(textA, false);
  const normB = sanitizeTranscript(textB, false);

  if (!normA) return normB;
  if (!normB) return normA;
  if (normA === normB) return normA;
  if (normA.endsWith(normB)) return normA;
  if (normB.startsWith(normA)) return normB;

  const wordsA = normA.split(' ');
  const wordsB = normB.split(' ');

  // Search for the longest word sequence at end of wordsA matching start of wordsB
  const maxSearchLen = Math.min(wordsA.length, wordsB.length);
  let maxOverlapCount = 0;

  for (let len = maxSearchLen; len > 0; len--) {
    const endSliceA = wordsA.slice(wordsA.length - len).join(' ').toLowerCase();
    const startSliceB = wordsB.slice(0, len).join(' ').toLowerCase();

    if (endSliceA === startSliceB) {
      maxOverlapCount = len;
      break;
    }
  }

  if (maxOverlapCount > 0) {
    const uniqueBWords = wordsB.slice(maxOverlapCount);
    if (uniqueBWords.length === 0) return normA;
    return `${normA} ${uniqueBWords.join(' ')}`;
  }

  return `${normA} ${normB}`;
}

/**
 * Combines stable accumulated final transcript with live interim transcript
 * for immediate latency-free rendering.
 */
export function combineFinalAndPartial(finalTranscript, partialTranscript) {
  const cleanFinal = sanitizeTranscript(finalTranscript, false);
  const cleanPartial = sanitizeTranscript(partialTranscript, false);

  if (!cleanFinal) return cleanPartial;
  if (!cleanPartial) return cleanFinal;

  return mergeOverlappingText(cleanFinal, cleanPartial);
}
