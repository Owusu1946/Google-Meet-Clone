"use client";
import { useEffect, useRef } from 'react';
import usePreviewMedia from '@/hooks/usePreviewMedia';
import Mic from './icons/Mic';
import MicOff from './icons/MicOff';
import Videocam from './icons/Videocam';
import VideocamOff from './icons/VideocamOff';

export default function MeetingPreview() {
  const { preferences, change, stream, devices, error, busy } = usePreviewMedia();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (video.current) video.current.srcObject = stream || null; }, [stream]);
  const cameraAvailable = !!stream?.getVideoTracks().length;
  const selector = (kind: MediaDeviceKind, label: string, value: string | undefined, field: 'audioId' | 'videoId' | 'speakerId') => <label className="flex flex-col gap-1 text-xs text-meet-gray min-w-0">{label}<select className="border border-hairline-gray rounded-lg p-2 text-sm w-full" value={value || ''} onChange={event => change({ [field]: event.target.value })}><option value="">System default</option>{devices.filter(device => device.kind === kind).map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `${label} ${index + 1}`}</option>)}</select></label>;
  return <section className="w-full"><div className="relative aspect-video rounded-2xl bg-meet-black overflow-hidden grid place-items-center">
    <video ref={video} autoPlay playsInline muted className={`w-full h-full object-cover -scale-x-100 ${cameraAvailable ? '' : 'hidden'}`} />
    {!cameraAvailable && <p className="text-white text-xl">{busy && preferences.camera ? 'Camera is starting…' : 'Camera is off'}</p>}
    <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-4">
      <button disabled={busy} aria-label={preferences.mic ? 'Turn off microphone' : 'Turn on microphone'} aria-pressed={preferences.mic} onClick={() => change({ mic: !preferences.mic })} className={`preview-control ${preferences.mic ? '' : 'bg-meet-red'}`}>{preferences.mic ? <Mic /> : <MicOff />}</button>
      <button disabled={busy} aria-label={preferences.camera ? 'Turn off camera' : 'Turn on camera'} aria-pressed={preferences.camera} onClick={() => change({ camera: !preferences.camera })} className={`preview-control ${preferences.camera ? '' : 'bg-meet-red'}`}>{preferences.camera ? <Videocam /> : <VideocamOff />}</button>
    </div>
  </div><div className="grid gap-3 sm:grid-cols-2 mt-4">{selector('audioinput', 'Microphone', preferences.audioId, 'audioId')}{selector('videoinput', 'Camera', preferences.videoId, 'videoId')}</div>
    <p className="text-xs text-meet-gray mt-3">Your microphone and camera stay off until you turn them on. You can change devices during the meeting.</p>
    {error && <p className="text-sm text-meet-red mt-3" role="alert">{error}</p>}
  </section>;
}
