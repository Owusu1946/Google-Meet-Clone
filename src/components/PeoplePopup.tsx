import { CallParticipantResponse, StreamVideoParticipant } from '@stream-io/video-react-sdk';
import { useEffect, useRef, useState } from 'react';
import Popup from './Popup';
import Avatar from './Avatar';
import Mic from './icons/Mic';
import MicOff from './icons/MicOff';
import Videocam from './icons/Videocam';
import VideocamOff from './icons/VideocamOff';

interface PeoplePopupProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Array<CallParticipantResponse | StreamVideoParticipant>;
  hostId?: string;
  raisedUserIds?: string[];
}

const PeoplePopup = ({ isOpen, onClose, participants, hostId, raisedUserIds = [] }: PeoplePopupProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const id = window.setTimeout(() => setEntered(true), 0);
      return () => window.clearTimeout(id);
    } else {
      setEntered(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const root = document.getElementById('meeting-root');
    if (!root) return;

    const applyPadding = () => {
      if (!isOpen || !panelRef.current) {
        root.style.paddingRight = '';
        return;
      }
      const width = panelRef.current.offsetWidth || 0;
      root.style.paddingRight = `${width + 16}px`;
    };

    applyPadding();
    const onResize = () => applyPadding();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      root.style.paddingRight = '';
    };
  }, [isOpen]);
  return (
    <Popup
      ref={panelRef as any}
      open={isOpen}
      onClose={onClose}
      title={<h2>People</h2>}
      className={
        `bottom-[5rem] right-4 left-auto h-[calc(100svh-6rem)] ` +
        `transition-all duration-300 ease-out ` +
        `${entered ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`
      }
    >
      <div className="px-4 pb-4 pt-2 h-[calc(100%-66px)] overflow-auto">
        <ul className="flex flex-col gap-3">
          {participants.map((p) => {
            const key = (p as any).user_session_id || (p as any).sessionId || (p as any).userId;
            const userObj = (p as any).user ?? p;
            const username = userObj?.custom?.username as string | undefined;
            const nameFallback = (p as any).name || userObj?.name || userObj?.id || (p as any).userId;
            const displayName = username || nameFallback;
            const audioOn =
              (p as any).audioEnabled ??
              (p as any).isAudioEnabled ??
              Boolean((p as any).audioStream?.enabled) ??
              false;
            const videoOn =
              (p as any).videoEnabled ??
              (p as any).isVideoEnabled ??
              Boolean((p as any).videoStream?.enabled) ??
              false;
            const uid = (p as any).userId || userObj?.id;
            const isHost = hostId && uid === hostId;
            const handRaised = uid ? raisedUserIds.includes(uid) : false;
            const isSpeaking = Boolean((p as any).isSpeaking || (p as any).isDominantSpeaker);
            return (
              <li key={key} className="flex items-center gap-3">
                <Avatar participant={p as any} width={32} />
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-meet-black text-sm font-medium mr-1">{displayName}</span>
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${audioOn ? 'bg-emerald-500' : 'bg-gray-400'}`}
                      title={audioOn ? 'Microphone on' : 'Microphone off'}
                    />
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${videoOn ? 'bg-emerald-500' : 'bg-gray-400'}`}
                      title={videoOn ? 'Camera on' : 'Camera off'}
                    />
                    {isHost && (
                      <span className="text-[10px] leading-4 px-1.5 py-0.5 rounded bg-meet-blue text-white">Host</span>
                    )}
                    {handRaised && (
                      <span className="text-meet-black/70" title="Hand raised">✋</span>
                    )}
                    {isSpeaking && (
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Speaking" />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {participants.length === 0 && (
            <li className="text-meet-black/70 text-sm">No one else is here</li>
          )}
        </ul>
      </div>
    </Popup>
  );
};

export default PeoplePopup;
