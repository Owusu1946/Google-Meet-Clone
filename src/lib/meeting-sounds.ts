'use client';

export type MeetingSound = 'join' | 'leave' | 'request' | 'end';
let context: AudioContext | undefined;
const notes: Record<MeetingSound, number[]> = {
  join: [440, 660],
  leave: [660, 440],
  request: [523, 784, 523],
  end: [523, 392, 262],
};

// Unlock once from a real gesture. Keep the context across route transitions so
// the final tone is not cut off when the meeting screen unmounts.
export function unlockMeetingSounds() {
  try {
    context ||= new AudioContext();
    void context.resume().catch(() => undefined);
  } catch {
    // Audio is optional on unsupported devices.
  }
}
export function playMeetingSound(sound: MeetingSound) {
  if (!context || context.state !== 'running') return;
  const start = context.currentTime;
  notes[sound].forEach((frequency, index) => {
    const oscillator = context!.createOscillator();
    const gain = context!.createGain();
    const time = start + index * 0.14;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.06, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    oscillator.connect(gain);
    gain.connect(context!.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.14);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  });
}
