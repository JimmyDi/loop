export const voices = ["kick", "snare", "hat"] as const;
export type Voice = (typeof voices)[number];

export const createDrumAudio = () => {
  const context = new AudioContext();
  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.2), context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;

  const hit = (voice: Voice, at = context.currentTime) => {
    const gain = context.createGain();
    const duration = voice === "hat" ? 0.05 : 0.18;
    gain.gain.setValueAtTime(voice === "kick" ? 0.55 : 0.18, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    gain.connect(context.destination);
    if (voice === "kick") {
      const oscillator = context.createOscillator();
      oscillator.frequency.setValueAtTime(150, at);
      oscillator.frequency.exponentialRampToValueAtTime(42, at + duration);
      oscillator.connect(gain);
      oscillator.start(at);
      oscillator.stop(at + duration);
      oscillator.onended = () => gain.disconnect();
      return;
    }
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = voice === "hat" ? 6500 : 1000;
    source.connect(filter).connect(gain);
    source.start(at);
    source.stop(at + duration);
    source.onended = () => {
      filter.disconnect();
      gain.disconnect();
    };
  };
  return { context, hit };
};
