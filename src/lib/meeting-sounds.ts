'use client';

export type MeetingSound = 'join' | 'leave' | 'request' | 'end';
let context: AudioContext | undefined;
let audio: Promise<AudioBuffer> | undefined;

// Keep the original join cue unchanged. Other events use subtle pitch/tempo
// variations of the same recording to retain its timbre and short chime feel.
const playback: Record<MeetingSound, { rate: number; volume: number }> = {
  join: { rate: 1, volume: 1 },
  leave: { rate: 0.85, volume: 0.8 },
  request: { rate: 1.12, volume: 0.9 },
  end: { rate: 0.7, volume: 0.9 },
};

function loadSound(current: AudioContext) {
  audio ||= fetch('/sounds/meeting-join.ogg')
    .then((response) => {
      if (!response.ok) throw new Error('Meeting sound unavailable.');
      return response.arrayBuffer();
    })
    .then((buffer) => current.decodeAudioData(buffer))
    .catch((error: unknown) => {
      audio = undefined;
      throw error;
    });
  return audio;
}

// Unlock and preload from a real gesture. Keep audio across route transitions
// so leaving or ending the meeting does not cut off the final cue.
export function unlockMeetingSounds() {
  try {
    context ||= new AudioContext();
    void context.resume().catch(() => undefined);
    void loadSound(context).catch(() => undefined);
  } catch {
    // Audio is optional on unsupported devices.
  }
}
export function playMeetingSound(sound: MeetingSound) {
  const current = context;
  if (!current || current.state !== 'running') return;
  void loadSound(current)
    .then((buffer) => {
      if (current.state !== 'running') return;
      const source = current.createBufferSource();
      const gain = current.createGain();
      source.buffer = buffer;
      source.playbackRate.value = playback[sound].rate;
      gain.gain.value = playback[sound].volume;
      source.connect(gain);
      gain.connect(current.destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start();
    })
    .catch(() => undefined);
}
