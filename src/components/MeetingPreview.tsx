'use client';
import { useEffect, useRef, useState } from 'react';
import usePreviewMedia from '@/hooks/usePreviewMedia';
import usePreviewBlur from '@/hooks/usePreviewBlur';
import MediaPermissionDialog, {
  type PermissionTarget,
} from './MediaPermissionDialog';
import Dialog from './Dialog';
import BlurChoices from './BlurChoices';
import Mic from './icons/Mic';
import MicOff from './icons/MicOff';
import Videocam from './icons/Videocam';
import VideocamOff from './icons/VideocamOff';
import VisualEffects from './icons/VisualEffects';
import VolumeUp from './icons/VolumeUp';

function PreviewVideo({
  stream,
  className = '',
}: {
  stream?: MediaStream;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (element) element.srcObject = stream || null;
    return () => {
      if (element) element.srcObject = null;
    };
  }, [stream]);
  return <video ref={video} autoPlay playsInline muted className={className} />;
}
export default function MeetingPreview({
  name = 'You',
  waiting = false,
}: {
  name?: string;
  waiting?: boolean;
}) {
  const {
    preferences,
    change,
    requestDevices,
    permissions,
    stream,
    devices,
    error,
    busy,
    ready,
  } = usePreviewMedia();
  const blur = usePreviewBlur(stream, preferences.blur);
  const [permission, setPermission] = useState<PermissionTarget>();
  const [effects, setEffects] = useState(false);
  const cameraOn = !!stream
    ?.getVideoTracks()
    .some((track) => track.readyState === 'live');
  const micOn = !!stream
    ?.getAudioTracks()
    .some((track) => track.readyState === 'live');
  const needsPermission =
    permissions.mic !== 'granted' &&
    permissions.camera !== 'granted' &&
    !cameraOn &&
    !micOn;
  const toggle = (kind: 'mic' | 'camera') => {
    if (preferences[kind]) change({ [kind]: false });
    else if (permissions[kind] === 'granted') requestDevices({ [kind]: true });
    else setPermission(kind);
  };
  const allow = (target: PermissionTarget) => {
    setPermission(undefined);
    requestDevices({
      ...(target !== 'camera' ? { mic: true } : {}),
      ...(target !== 'mic' ? { camera: true } : {}),
    });
  };
  const selector = (
    kind: MediaDeviceKind,
    label: string,
    field: 'audioId' | 'videoId' | 'speakerId',
    granted: boolean,
    icon: React.ReactNode,
  ) => (
    <label className="lobby-device">
      <span className="sr-only">{label}</span>
      {icon}
      <select
        aria-label={label}
        value={preferences[field] || ''}
        disabled={!granted || busy}
        onChange={(event) => change({ [field]: event.target.value })}
      >
        <option value="">{granted ? label : 'Permission needed'}</option>
        {devices
          .filter((device) => device.kind === kind && device.deviceId)
          .map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `${label} ${index + 1}`}
            </option>
          ))}
      </select>
    </label>
  );
  return (
    <section
      className={`lobby-preview ${waiting ? 'is-waiting' : ''}`}
      aria-label="Camera and microphone preview"
    >
      <div className="lobby-preview-stage">
        <span className="lobby-preview-name">{name}</span>
        <PreviewVideo
          stream={blur.stream}
          className={`lobby-preview-video ${cameraOn && !blur.busy ? '' : 'hidden'}`}
        />
        {!cameraOn && (
          <div className="lobby-preview-message">
            {busy ? (
              <p>Getting your devices ready…</p>
            ) : needsPermission && !waiting ? (
              <>
                <h2>Do you want people to see and hear you in the meeting?</h2>
                <button
                  className="lobby-allow"
                  onClick={() => setPermission('both')}
                  disabled={!ready}
                >
                  Allow microphone and camera
                </button>
              </>
            ) : (
              <>
                <span className="lobby-avatar">{name[0]?.toUpperCase()}</span>
                {!waiting && <p>Camera is off</p>}
              </>
            )}
          </div>
        )}
        {blur.busy && (
          <p className="lobby-preview-message" role="status">
            Preparing background blur…
          </p>
        )}
        <div className="lobby-preview-controls">
          <button
            disabled={busy || !ready}
            aria-label={micOn ? 'Turn off microphone' : 'Turn on microphone'}
            aria-pressed={micOn}
            className={`lobby-media-button ${micOn ? 'enabled' : ''}`}
            onClick={() => toggle('mic')}
          >
            {micOn ? <Mic /> : <MicOff />}
            {permissions.mic !== 'granted' && (
              <span
                className="device-warning"
                aria-label="Microphone permission needed"
              >
                !
              </span>
            )}
          </button>
          <button
            disabled={busy || !ready}
            aria-label={cameraOn ? 'Turn off camera' : 'Turn on camera'}
            aria-pressed={cameraOn}
            className={`lobby-media-button ${cameraOn ? 'enabled' : ''}`}
            onClick={() => toggle('camera')}
          >
            {cameraOn ? <Videocam /> : <VideocamOff />}
            {permissions.camera !== 'granted' && (
              <span
                className="device-warning"
                aria-label="Camera permission needed"
              >
                !
              </span>
            )}
          </button>
        </div>
        <button
          className="lobby-effects-button"
          aria-label="Background blur"
          onClick={() => setEffects(true)}
        >
          <VisualEffects />
        </button>
      </div>
      {!waiting && (
        <div className="lobby-device-row">
          {selector(
            'audioinput',
            'Microphone',
            'audioId',
            permissions.mic === 'granted',
            <Mic />,
          )}
          {selector(
            'audiooutput',
            'Speakers',
            'speakerId',
            permissions.mic === 'granted' || permissions.camera === 'granted',
            <VolumeUp />,
          )}
          {selector(
            'videoinput',
            'Camera',
            'videoId',
            permissions.camera === 'granted',
            <Videocam />,
          )}
        </div>
      )}
      {(error || blur.error) && (
        <p className="lobby-media-error" role="alert">
          {error || blur.error}
        </p>
      )}
      <MediaPermissionDialog
        target={permission}
        onClose={() => setPermission(undefined)}
        onAllow={allow}
        busy={busy}
      />
      <Dialog
        open={effects}
        onClose={() => setEffects(false)}
        title="Backgrounds and effects"
        className="effects-dialog"
      >
        <div className="effects-dialog-layout">
          <div className="effects-preview">
            {cameraOn ? (
              <PreviewVideo
                stream={blur.stream}
                className="lobby-preview-video"
              />
            ) : (
              <div className="effects-camera-off">
                <VideocamOff />
                <p>Turn on your camera to preview background blur</p>
                <button
                  className="primary-button"
                  onClick={() => {
                    setEffects(false);
                    setPermission('camera');
                  }}
                >
                  Use camera
                </button>
              </div>
            )}
            {blur.busy && (
              <p className="effects-status" role="status">
                Preparing blur…
              </p>
            )}
          </div>
          <div>
            <div className="effects-tab">Backgrounds</div>
            <BlurChoices
              value={preferences.blur}
              onChange={(value) => change({ blur: value })}
              disabled={blur.busy}
            />
            {blur.error && (
              <p role="alert" className="text-meet-red text-sm mt-4">
                {blur.error}
              </p>
            )}
            <p className="text-sm text-meet-gray mt-5">
              Your selection carries into the meeting. Blur availability depends
              on your device.
            </p>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
