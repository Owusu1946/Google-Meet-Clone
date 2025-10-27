import { useEffect, useRef, useState } from 'react';
import {
  DefaultStreamChatGenerics,
  MessageInput,
  MessageList,
  Channel,
  Window,
} from 'stream-chat-react';
import { type Channel as ChannelType } from 'stream-chat';

import Popup from './Popup';

interface ChatPopupProps {
  isOpen: boolean;
  onClose: () => void;
  channel: ChannelType<DefaultStreamChatGenerics>;
}

const ChatPopup = ({ channel, isOpen, onClose }: ChatPopupProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // trigger enter animation on open
    if (isOpen) {
      // next tick to ensure initial styles apply
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
      // Add 16px gutter to match `right-4`
      root.style.paddingRight = `${width + 16}px`;
    };

    applyPadding();
    // Re-apply on resize in case responsive width changes
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
      title={<h2>In-call messages</h2>}
      className={
        `bottom-[5rem] right-4 left-auto h-[calc(100svh-6rem)] ` +
        `transition-all duration-300 ease-out ` +
        `${entered ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`
      }
    >
      <div className="px-0 pb-3 pt-0 h-[calc(100%-66px)]">
        <Channel channel={channel}>
          <Window>
            <MessageList disableDateSeparator />
            <MessageInput noFiles />
          </Window>
        </Channel>
      </div>
    </Popup>
  );
};

export default ChatPopup;
