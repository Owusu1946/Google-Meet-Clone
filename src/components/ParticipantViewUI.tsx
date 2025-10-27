import {
  ComponentProps,
  ForwardedRef,
  forwardRef,
  ReactNode,
  useState,
  useEffect,
} from 'react';
import {
  DefaultParticipantViewUIProps,
  DefaultScreenShareOverlay,
  hasAudio,
  hasScreenShare,
  isPinned,
  MenuToggle,
  OwnCapability,
  ParticipantActionsContextMenu,
  ToggleMenuButtonProps,
  useCall,
  useCallStateHooks,
  useParticipantViewContext,
} from '@stream-io/video-react-sdk';
import clsx from 'clsx';

import Keep from './icons/Keep';
import KeepFilled from './icons/KeepFilled';
import KeepOffFilled from './icons/KeepOffFilled';
import KeepPublicFilled from './icons/KeepPublicFilled';
import MicOffFilled from './icons/MicOffFilled';
import SpeechIndicator from './SpeechIndicator';
import VisualEffects from './icons/VisualEffects';
import MoreVert from './icons/MoreVert';
import BackHand from './icons/BackHand';
import { useRaisedHands } from '@/contexts/RaisedHandsContext';

export const speechRingClassName = 'speech-ring';
export const menuOverlayClassName = 'menu-overlay';

const ParticipantViewUI = () => {
  const call = useCall();
  const { useHasPermissions } = useCallStateHooks();
  const { participant, trackType } = useParticipantViewContext();
  const [showMenu, setShowMenu] = useState(false);

  const {
    pin,
    sessionId,
    isLocalParticipant,
    isSpeaking,
    isDominantSpeaker,
    userId,
  } = participant;
  const isScreenSharing = hasScreenShare(participant);
  const hasAudioTrack = hasAudio(participant);
  const canUnpinForEveryone = useHasPermissions(OwnCapability.PIN_FOR_EVERYONE);
  const pinned = isPinned(participant);

  const unpin = () => {
    if (pin?.isLocalPin || !canUnpinForEveryone) {
      call?.unpin(sessionId);
    } else {
      call?.unpinForEveryone({
        user_id: userId,
        session_id: sessionId,
      });
    }
  };

  if (isLocalParticipant && isScreenSharing && trackType === 'screenShareTrack')
    return (
      <>
        <DefaultScreenShareOverlay />
        <ParticipantDetails />
      </>
    );

  return (
    <>
      <ParticipantDetails />
      {hasAudioTrack && (
        <div className="absolute top-3.5 right-3.5 w-6.5 h-6.5 flex items-center justify-center bg-primary rounded-full">
          <SpeechIndicator
            isSpeaking={isSpeaking}
            isDominantSpeaker={isDominantSpeaker}
          />
        </div>
      )}
      {!hasAudioTrack && (
        <div className="absolute top-3.5 right-3.5 w-6.5 h-6.5 flex items-center justify-center bg-[#2021244d] rounded-full">
          <MicOffFilled width={18} height={18} />
        </div>
      )}
      {/* Speech Ring */}
      <div
        className={clsx(
          isSpeaking &&
            hasAudioTrack &&
            'ring-[5px] ring-inset ring-light-blue',
          `absolute left-0 top-0 w-full h-full rounded-xl ${speechRingClassName}`
        )}
      />
      {/* Menu Overlay */}
      <div
        onMouseOver={() => {
          setShowMenu(true);
        }}
        onMouseOut={() => setShowMenu(false)}
        className={`absolute z-1 left-0 top-0 w-full h-full rounded-xl bg-transparent ${menuOverlayClassName}`}
      />
      {/* Menu */}
      <div
        className={clsx(
          showMenu ? 'opacity-60' : 'opacity-0',
          'z-2 absolute left-[calc(50%-66px)] top-[calc(50%-22px)] flex items-center justify-center h-11 transition-opacity duration-300 ease-linear overflow-hidden',
          'shadow-[0_1px_2px_0px_rgba(0,0,0,0.3),_0_1px_3px_1px_rgba(0,0,0,.15)] bg-meet-black rounded-full h-11 hover:opacity-90'
        )}
      >
        <div className="[&_ul>*:nth-child(n+4)]:hidden">
          {!pinned && (
            <MenuToggle
              strategy="fixed"
              placement="bottom-start"
              ToggleButton={PinMenuToggleButton}
            >
              <ParticipantActionsContextMenu />
            </MenuToggle>
          )}
          {pinned && (
            <Button title="Unpin" onClick={unpin} icon={<KeepOffFilled />} />
          )}
        </div>
        <Button title="Apply visual effects" icon={<VisualEffects />} />
        <div className="[&_ul>*:nth-child(-n+3)]:hidden">
          <MenuToggle
            strategy="fixed"
            placement="bottom-start"
            ToggleButton={OtherMenuToggleButton}
          >
            <ParticipantActionsContextMenu />
          </MenuToggle>
        </div>
      </div>
    </>
  );
};

const ParticipantDetails = ({}: Pick<
  DefaultParticipantViewUIProps,
  'indicatorsVisible'
>) => {
  const { participant } = useParticipantViewContext();
  const { pin, name, userId } = participant;
  const pinned = !!pin;
  const { raisedUserIds } = useRaisedHands();
  const isRaised = raisedUserIds.includes(userId);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  // Morph animation: start as circular icon and expand into pill with text
  // On lower: collapse back to circular then hide
  useEffect(() => {
    if (isRaised) {
      setVisible(true);
      setExpanded(false);
      const id = window.setTimeout(() => setExpanded(true), 60);
      return () => window.clearTimeout(id);
    } else {
      setExpanded(false);
      const id = window.setTimeout(() => setVisible(false), 360);
      return () => window.clearTimeout(id);
    }
  }, [isRaised]);

  return (
    <>
      <div className="z-1 absolute left-0 bottom-[.65rem] max-w-94 h-fit truncate font-medium text-white text-sm flex items-center justify-start gap-4 mt-1.5 mx-4 mb-0 cursor-default select-none">
        {pinned && (pin.isLocalPin ? <KeepFilled /> : <KeepPublicFilled />)}
        {visible ? (
          <span
            className={
              `inline-flex items-center bg-green-400 text-meet-black rounded-full transform ` +
              `h-7 transition-all duration-400 ` +
              `${expanded ? 'px-3 gap-2 scale-100' : 'w-7 justify-center px-0 scale-95'}`
            }
            title="Hand raised"
            style={{
              transitionTimingFunction: expanded
                ? 'cubic-bezier(0.18, 0.89, 0.32, 1.28)'
                : 'cubic-bezier(0.4, 0, 1, 1)',
            }}
          >
            <span className="w-4 h-4 flex items-center justify-center">
              <BackHand />
            </span>
            <span
              className={
                `font-medium whitespace-nowrap transition-opacity duration-300 ease-out ` +
                `${expanded ? 'opacity-100' : 'opacity-0'}`
              }
              style={{
                // prevent layout jump during morph
                overflow: 'hidden',
              }}
            >
              {name || userId}
            </span>
          </span>
        ) : (
          <span
            style={{
              textShadow: '0 1px 2px rgba(0,0,0,.6), 0 0 2px rgba(0,0,0,.3)',
            }}
          >
            {name || userId}
          </span>
        )}
      </div>
    </>
  );
};

const Button = forwardRef(function Button(
  {
    icon,
    onClick = () => null,
    menuShown,
    ...rest
  }: {
    icon: ReactNode;
    onClick?: () => void;
  } & ComponentProps<'button'> & { menuShown?: boolean },
  ref: ForwardedRef<HTMLButtonElement>
) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
      {...rest}
      ref={ref}
      className="h-11 w-11 rounded-full p-2.5 bg-transparent border-transparent outline-none hover:bg-[rgba(232,234,237,.15)] transition-[background] duration-150 ease-linear"
    >
      {icon}
    </button>
  );
});

const PinMenuToggleButton = forwardRef<
  HTMLButtonElement,
  ToggleMenuButtonProps
>(function ToggleButton(props, ref) {
  return <Button {...props} title="Pin" ref={ref} icon={<Keep />} />;
});

const OtherMenuToggleButton = forwardRef<
  HTMLButtonElement,
  ToggleMenuButtonProps
>(function ToggleButton(props, ref) {
  return (
    <Button {...props} title="More options" ref={ref} icon={<MoreVert />} />
  );
});

export default ParticipantViewUI;
