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
  const [thread, setThread] = useState<FormatMessageResponse>();
  return (
    <ChatConversation
      key={thread?.id || 'main'}
      channel={channel}
      chatError={chatError}
      parent={thread}
      openThread={setThread}
    />
  );
}

function ChatConversation({
  channel,
  chatError,
  parent,
  openThread,
}: {
  channel?: Channel;
  chatError: string;
  parent?: FormatMessageResponse;
  openThread: (message?: FormatMessageResponse) => void;
}) {
  const [messages, setMessages] = useState<FormatMessageResponse[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [more, setMore] = useState(true);
  const [typing, setTyping] = useState<string[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const attempted = useRef<{ id: string; text: string } | undefined>(undefined);
  const parentId = parent?.id;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!channel) return;
    let cancelled = false;
    const typists = new Map<string, { name: string; until: number }>();
    const sync = () => {
      if (cancelled) return;
      setMessages([
        ...(parentId
          ? channel.state.threads[parentId] || []
          : channel.state.messages),
      ]);
    };
    sync();
    if (parentId) {
      setLoadingOlder(true);
      void channel
        .getReplies(parentId, { limit: 50 })
        .then((result) => {
          if (!cancelled) {
            sync();
            setMore(result.messages.length >= 50);
          }
        })
        .catch((failure) => {
          if (!cancelled) setError(errorMessage(failure));
        })
        .finally(() => {
          if (!cancelled) setLoadingOlder(false);
        });
    }
    const updateTyping = () => {
      const now = Date.now();
      for (const [id, value] of typists)
        if (value.until < now) typists.delete(id);
      setTyping([...typists.values()].map((value) => value.name));
    };
    const subscription = channel.on((event) => {
      if (
        ['message.new', 'message.updated', 'message.deleted'].includes(
          event.type,
        )
      )
        sync();
      if (
        (event.type === 'typing.start' || event.type === 'typing.stop') &&
        event.user?.id !== channel.getClient().userID &&
        (event.parent_id || undefined) === parentId &&
        event.user?.id
      ) {
        if (event.type === 'typing.stop') typists.delete(event.user.id);
        else
          typists.set(event.user.id, {
            name: event.user.name || 'Participant',
            until: Date.now() + 6000,
          });
        updateTyping();
      }
    });
    const timer = setInterval(updateTyping, 1000);
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearInterval(timer);
      void channel.stopTyping(parentId).catch(() => undefined);
    };
  }, [channel, parentId]);
  const lastMessage = messages.at(-1)?.id;
  useEffect(() => {
    const element = scroll.current;
    if (
      element &&
      element.scrollHeight - element.scrollTop - element.clientHeight < 180
    )
      bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [lastMessage]);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(typingTimeout.current), []);
  const changeText = (value: string) => {
    setText(value);
    clearTimeout(typingTimeout.current);
    if (value.trim()) {
      void channel?.keystroke(parentId).catch(() => undefined);
      typingTimeout.current = setTimeout(
        () => void channel?.stopTyping(parentId).catch(() => undefined),
        3000,
      );
    } else void channel?.stopTyping(parentId).catch(() => undefined);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!channel || !text.trim() || sending) return;
    const content = text.trim();
    if (!attempted.current || attempted.current.text !== content)
      attempted.current = { id: crypto.randomUUID(), text: content };
    setSending(true);
    setError('');
    clearTimeout(typingTimeout.current);
    void channel.stopTyping(parentId).catch(() => undefined);
    try {
      await channel.sendMessage({
        ...attempted.current,
        ...(parentId ? { parent_id: parentId, show_in_channel: true } : {}),
      });
      if (mounted.current) {
        setText('');
        attempted.current = undefined;
        bottom.current?.scrollIntoView({ block: 'nearest' });
      }
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
    } finally {
      if (mounted.current) setSending(false);
    }
  };
  const older = async () => {
    if (!channel || loadingOlder || !messages[0]) return;
    setLoadingOlder(true);
    setError('');
    const element = scroll.current;
    const height = element?.scrollHeight || 0;
    try {
      const options = { id_lt: messages[0].id, limit: 50 };
      const result = parentId
        ? await channel.getReplies(parentId, options)
        : await channel.query({ messages: options });
      if (mounted.current) {
        setMore((result.messages?.length || 0) >= 50);
        setMessages([
          ...(parentId
            ? channel.state.threads[parentId] || []
            : channel.state.messages),
        ]);
        requestAnimationFrame(() => {
          if (element) element.scrollTop += element.scrollHeight - height;
        });
      }
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
    } finally {
      if (mounted.current) setLoadingOlder(false);
    }
  };
  const renderMessage = (message: FormatMessageResponse, root = false) => (
    <article
      key={message.id}
      className={root ? 'border-b border-hairline-gray pb-4' : ''}
    >
      <div className="flex gap-2 items-center text-xs">
        <span className="font-medium text-meet-black">
          {message.user?.name || 'Participant'}
        </span>
        <time className="text-meet-gray">
          {new Date(message.created_at || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>
      <p className="text-sm whitespace-pre-wrap break-words mt-1">
        {message.deleted_at ? 'Message deleted' : message.text}
      </p>
      {!parentId && !message.deleted_at && (
        <button
          className="text-primary text-xs mt-2"
          onClick={() => openThread(message)}
        >
          {message.reply_count
            ? `${message.reply_count} ${message.reply_count === 1 ? 'reply' : 'replies'}`
            : 'Reply'}
        </button>
      )}
    </article>
  );
  return (
    <>
      {parent && (
        <div className="px-5 py-3 border-b border-hairline-gray">
          <button className="text-primary text-sm" onClick={() => openThread()}>
            ← All messages
          </button>
          <p className="font-medium mt-2">Thread</p>
        </div>
      )}
      <div
        ref={scroll}
        className="flex-1 overflow-y-auto p-5 space-y-5"
        role="log"
        aria-label={parent ? 'Thread replies' : 'Meeting messages'}
      >
        {!channel && (
          <p role="status" className="text-sm">
            {chatError || 'Connecting to chat…'}
          </p>
        )}
        {parent && renderMessage(parent, true)}
        {channel && more && (messages.length >= 25 || parentId) && (
          <button
            className="text-primary text-sm"
            onClick={() => void older()}
            disabled={loadingOlder}
          >
            {loadingOlder ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}
        {messages
          .filter((message) =>
            parentId ? true : !message.parent_id && !message.deleted_at,
          )
          .map((message) => renderMessage(message))}
        {channel && !messages.length && !loadingOlder && (
          <p className="text-sm text-meet-gray">
            {parent
              ? 'Start a reply in this thread.'
              : 'Messages are visible to admitted meeting participants.'}
          </p>
        )}
        <div ref={bottom} />
      </div>
      <div
        role="status"
        aria-live="polite"
        className="px-5 text-xs text-meet-gray min-h-5"
      >
        {typing.length > 0 &&
          `${typing.slice(0, 3).join(', ')}${typing.length > 3 ? ' and others' : ''} ${typing.length === 1 ? 'is' : 'are'} typing…`}
      </div>
      <form className="p-4 border-t border-hairline-gray" onSubmit={submit}>
        <label className="sr-only" htmlFor="meeting-message">
          {parent ? 'Reply to thread' : 'Message everyone'}
        </label>
        <div className="flex gap-2">
          <input
            id="meeting-message"
            maxLength={2000}
            value={text}
            onChange={(event) => changeText(event.target.value)}
            onBlur={() =>
              void channel?.stopTyping(parentId).catch(() => undefined)
            }
            placeholder={
              parent ? 'Reply in this thread' : 'Send a message to everyone'
            }
            disabled={!channel || sending}
            className="rounded-full bg-light-gray px-4 py-3 min-w-0 flex-1 text-sm"
          />
          <button
            disabled={!channel || !text.trim() || sending}
            className="text-primary text-sm disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
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
