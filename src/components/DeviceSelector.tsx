import { ReactNode, useState } from 'react';
import { useCallStateHooks } from '@stream-io/video-react-sdk';

import { errorMessage } from '@/lib/meeting';
import {
  readDevicePreferences,
  saveDevicePreferences,
} from '@/hooks/usePreviewMedia';
import Dropdown from './Dropdown';
import Mic from './icons/Mic';
import Videocam from './icons/Videocam';
import VolumeUp from './icons/VolumeUp';

type DeviceSelectorProps = {
  devices: MediaDeviceInfo[] | undefined;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => Promise<void> | void;
  preference?: 'audioId' | 'videoId' | 'speakerId';
  icon: ReactNode;
  disabled?: boolean;
  className?: string;
  dark?: boolean;
};

type SelectorProps = {
  disabled?: boolean;
  className?: string;
  dark?: boolean;
};

export const DeviceSelector = ({
  devices,
  preference,
  selectedDeviceId,
  onSelect,
  icon,
  disabled = false,
  className = '',
  dark = false,
}: DeviceSelectorProps) => {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const select = async (value: string) => {
    setBusy(true);
    setError('');
    try {
      await onSelect(value);
      if (preference)
        saveDevicePreferences({
          ...readDevicePreferences(),
          [preference]: value,
        });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };
  const label =
    devices?.find((device) => device.deviceId === selectedDeviceId)?.label ||
    'Default device';

  return (
    <div>
      <Dropdown
        label={disabled ? 'Permission needed' : label}
        value={selectedDeviceId}
        icon={icon}
        onChange={(value) => void select(value)}
        options={
          devices?.map((device) => ({
            label:
              device.label || `${device.kind} ${device.deviceId.slice(0, 6)}`,
            value: device.deviceId,
          })) || []
        }
        disabled={disabled || busy}
        className={className}
        dark={dark}
      />
      {error && (
        <p role="alert" className="text-xs text-meet-red mt-2">
          {error}
        </p>
      )}
    </div>
  );
};

export const AudioInputDeviceSelector = ({
  disabled = false,
  className = '',
  dark,
}: SelectorProps) => {
  const { useMicrophoneState } = useCallStateHooks();
  const { microphone, devices, selectedDevice } = useMicrophoneState();

  return (
    <DeviceSelector
      devices={devices}
      selectedDeviceId={selectedDevice}
      preference="audioId"
      onSelect={(deviceId) => microphone.select(deviceId)}
      icon={<Mic width={20} height={20} color="var(--meet-black)" />}
      disabled={disabled}
      className={className}
      dark={dark}
    />
  );
};

export const VideoInputDeviceSelector = ({
  disabled = false,
  className = '',
  dark = false,
}: SelectorProps) => {
  const { useCameraState } = useCallStateHooks();
  const { camera, devices, selectedDevice } = useCameraState();

  return (
    <DeviceSelector
      devices={devices}
      selectedDeviceId={selectedDevice}
      preference="videoId"
      onSelect={(deviceId) => camera.select(deviceId)}
      icon={<Videocam width={18} height={18} color="var(--meet-black)" />}
      disabled={disabled}
      className={className}
      dark={dark}
    />
  );
};

export const AudioOutputDeviceSelector = ({
  disabled = false,
  className = '',
  dark = false,
}: SelectorProps) => {
  const { useSpeakerState } = useCallStateHooks();
  const { speaker, devices, selectedDevice, isDeviceSelectionSupported } =
    useSpeakerState();

  if (!isDeviceSelectionSupported) return null;

  return (
    <DeviceSelector
      devices={devices}
      selectedDeviceId={
        selectedDevice
          ? selectedDevice
          : devices
            ? devices[0]?.deviceId
            : 'Default - ...'
      }
      preference="speakerId"
      onSelect={(deviceId) => speaker.select(deviceId)}
      icon={<VolumeUp width={20} height={20} color="var(--meet-black)" />}
      disabled={disabled}
      className={className}
      dark={dark}
    />
  );
};
