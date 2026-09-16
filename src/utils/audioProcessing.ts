/**
 * Audio processing utility functions for WeatherGPT voice pipeline.
 * - Linear resampling to 16,000 Hz mono
 * - Float32 to Signed 16-bit PCM conversion with clamping
 * - Audio energy / RMS calculation for real-time telemetry
 */

/**
 * Resamples a Float32Array from inputSampleRate to targetSampleRate using linear interpolation.
 */
export function resampleAudio(
  inputData: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number = 16000
): Float32Array {
  if (inputSampleRate === targetSampleRate || inputData.length === 0) {
    return new Float32Array(inputData);
  }

  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.round(inputData.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;

    const sample1 = inputData[index] || 0;
    const sample2 = inputData[Math.min(index + 1, inputData.length - 1)] || 0;

    // Linear interpolation between consecutive samples
    output[i] = sample1 + fraction * (sample2 - sample1);
  }

  return output;
}

/**
 * Converts Float32 audio samples (-1.0 to +1.0) into signed 16-bit PCM (Int16Array).
 * Accurately clamps samples to [-32768, 32767] to avoid integer overflow / wrapping.
 */
export function float32ToInt16PCM(float32Array: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32Array.length);

  for (let i = 0; i < float32Array.length; i++) {
    // Clamp sample to valid float range [-1.0, 1.0]
    const sample = Math.max(-1, Math.min(1, float32Array[i]));

    // Scale to 16-bit signed integer range: [-32768, 32767]
    pcm16[i] = sample < 0 ? Math.floor(sample * 0x8000) : Math.floor(sample * 0x7fff);
  }

  return pcm16;
}

/**
 * Calculates the Root-Mean-Square (RMS) amplitude of Float32 audio samples.
 * Returns a normalized value between 0.0 (silent) and 1.0 (full scale).
 */
export function calculateRMS(samples: Float32Array): number {
  if (!samples || samples.length === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  return Math.min(1, Math.max(0, rms));
}
