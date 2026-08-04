/**
 * AudioWorklet PCM Pipeline
 * Converts microphone audio stream to 16kHz 16-bit linear PCM in 20ms chunks (320 samples / 640 bytes)
 * without using deprecated ScriptProcessorNode or browser container buffering.
 */

const WORKLET_PROCESSOR_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);
    this.targetSampleRate = 16000;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const inputChannel = input[0];
    
    // Concatenate new input samples
    const newBuffer = new Float32Array(this.buffer.length + inputChannel.length);
    newBuffer.set(this.buffer);
    newBuffer.set(inputChannel, this.buffer.length);
    this.buffer = newBuffer;

    // Calculate downsampling ratio (e.g. 48000Hz -> 16000Hz = ratio of 3)
    const ratio = sampleRate / this.targetSampleRate;
    
    // We want 20ms chunks at 16kHz = 320 samples per output chunk
    const targetChunkSamples = 320;
    const requiredInputSamples = Math.floor(targetChunkSamples * ratio);

    while (this.buffer.length >= requiredInputSamples) {
      const inputChunk = this.buffer.subarray(0, requiredInputSamples);
      this.buffer = this.buffer.subarray(requiredInputSamples);

      // Downsample inputChunk to 320 samples at 16kHz
      const pcm16Data = new Int16Array(targetChunkSamples);
      for (let i = 0; i < targetChunkSamples; i++) {
        const srcIndex = Math.floor(i * ratio);
        const sample = Math.max(-1, Math.min(1, inputChunk[srcIndex] || 0));
        pcm16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }

      this.port.postMessage(pcm16Data.buffer, [pcm16Data.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
`;

export class AudioWorkletPCMPipeline {
  constructor(onAudioChunk) {
    this.onAudioChunk = onAudioChunk;
    this.audioCtx = null;
    this.mediaStream = null;
    this.workletNode = null;
    this.sourceNode = null;
    this.isActive = false;
  }

  async start() {
    if (this.isActive) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: 16000 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      // Create inline AudioWorklet module blob URL
      const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);

      await this.audioCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioCtx, 'pcm-processor');

      this.workletNode.port.onmessage = (event) => {
        if (this.isActive && this.onAudioChunk) {
          const chunkBuffer = event.data;
          this.onAudioChunk(chunkBuffer);
        }
      };

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioCtx.destination);
      this.isActive = true;
      console.log('[StreamingSTT] AudioWorklet PCM Pipeline Active (16kHz, 20ms chunks)');
    } catch (err) {
      console.error('[StreamingSTT] Failed to start AudioWorklet PCM pipeline:', err);
      this.stop();
      throw err;
    }
  }

  stop() {
    this.isActive = false;
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    console.log('[StreamingSTT] AudioWorklet PCM Pipeline Stopped');
  }
}
