'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Channel, FormatMessageResponse } from 'stream-chat';
import { errorMessage } from '@/lib/meeting';
export default function ChatPopup({
  channel,
  chatError,
}: {
  channel?: Channel;
  chatError: string;
}) {
  const [messages, setMessages] = useState<FormatMessageResponse[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [more, setMore] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!channel) return;
    const sync = () => setMessages([...channel.state.messages]);
    sync();
    const subscription = channel.on(sync);
    return () => subscription.unsubscribe();
  }, [channel]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages.length]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!channel || !text.trim() || sending) return;
    const content = text.trim();
    setSending(true);
    setError('');
    try {
      await channel.sendMessage({ text: content });
      setText('');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSending(false);
    }
  };
  const older = async () => {
    if (!channel || loadingOlder || !messages[0]) return;
    setLoadingOlder(true);
    try {
      const result = await channel.query({
        messages: { id_lt: messages[0].id, limit: 50 },
      });
      setMore((result.messages?.length || 0) >= 50);
      setMessages([...channel.state.messages]);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoadingOlder(false);
    }
  };
  return (
    <>
      <div
        className="flex-1 overflow-y-auto p-5 space-y-5"
        role="log"
        aria-label="Meeting messages"
      >
        {!channel && (
          <p role="status" className="text-sm">
            {chatError || 'Connecting to chat…'}
            {chatError && (
              <button
                className="block text-primary mt-3"
                onClick={() => window.location.reload()}
              >
                Reconnect
              </button>
            )}
          </p>
        )}
        {channel && more && messages.length >= 25 && (
          <button
            className="text-primary text-sm"
            onClick={() => void older()}
            disabled={loadingOlder}
          >
            {loadingOlder ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}
        {messages
          .filter((message) => !message.deleted_at)
          .map((message) => (
            <article key={message.id}>
              <div className="flex gap-2 items-center text-xs">
                <span className="font-medium text-meet-black">
                  {message.user?.name || 'Participant'}
                </span>
                <time className="text-meet-gray">
                  {new Date(
                    message.created_at || Date.now(),
                  ).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words mt-1">
                {message.text}
              </p>
            </article>
          ))}
        {channel && !messages.length && (
          <p className="text-sm text-meet-gray">
            Messages are visible to admitted meeting participants.
          </p>
        )}
        <div ref={bottom} />
      </div>
      <form className="p-4 border-t border-hairline-gray" onSubmit={submit}>
        <label className="sr-only" htmlFor="meeting-message">
          Message everyone
        </label>
        <div className="flex gap-2">
          <input
            id="meeting-message"
            maxLength={2000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Send a message to everyone"
            disabled={!channel || sending}
            className="rounded-full bg-light-gray px-4 py-3 min-w-0 flex-1 text-sm"
          />
          <button
            disabled={!channel || !text.trim() || sending}
            className="text-primary text-sm disabled:opacity-40"
          >
            Send
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-meet-red mt-2">
            {error}
          </p>
        )}
      </form>
    </>
  );
}
