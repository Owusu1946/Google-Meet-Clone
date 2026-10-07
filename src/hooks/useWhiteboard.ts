import { useCallback, useEffect, useRef, useState } from 'react';
import { useMeeting } from '@/contexts/MeetProvider';
import { api, BOARD_TYPE, errorMessage } from '@/lib/meeting';
import { type BoardOperation, validOperation } from '@/lib/whiteboard';
import type { MessageResponse } from 'stream-chat';

export default function useWhiteboard() {
  const { access, chatClient, chatError } = useMeeting();
  const [operations, setOperations] = useState<BoardOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(0);
  const stored = useRef(new Map<string, BoardOperation>());
  const queue = useRef<BoardOperation[]>([]);
  const sending = useRef<Promise<boolean> | undefined>(undefined);
  const historyRetry = useRef<(() => Promise<void>) | undefined>(undefined);
  const storageKey = `meet-board-pending:${access.meetingId}:${access.identity.id}`;
  const persist = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(queue.current));
    } catch {
      /* Storage is optional; leave remains guarded. */
    }
  }, [storageKey]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const accept = useCallback((operation: BoardOperation) => {
    stored.current.set(operation.id, operation);
    if (mounted.current) setOperations([...stored.current.values()]);
  }, []);
  useEffect(() => {
    try {
      const restored: unknown = JSON.parse(
        sessionStorage.getItem(storageKey) || '[]',
      );
      if (Array.isArray(restored)) {
        queue.current = restored
          .filter(validOperation)
          .filter((operation) => operation.actor === access.identity.id);
        queue.current.forEach(accept);
        setPending(queue.current.length);
      }
    } catch {
      /* Ignore corrupted local data. */
    }
  }, [storageKey, access.identity.id, accept]);
  useEffect(() => {
    if (!chatClient) {
      if (chatError) {
        setError(chatError);
        setLoading(false);
      }
      return;
    }
    let cancelled = false;
    const channel = chatClient.channel(BOARD_TYPE, access.meetingId);
    const read = (message: MessageResponse) => {
      const value = message.board_operation;
      if (validOperation(value) && value.actor === message.user?.id)
        accept({
          ...value,
          time: new Date(message.created_at || value.time).toISOString(),
        });
    };
    const subscription = channel.on('message.new', (event) => {
      if (!cancelled && event.message) read(event.message);
    });
    let loadingHistory = false;
    const history = async () => {
      if (loadingHistory) return;
      loadingHistory = true;
      try {
        const initial = await channel.watch({ messages: { limit: 100 } });
        let page = initial.messages || [];
        while (!cancelled) {
          page.forEach(read);
          if (page.length < 100) break;
          const before = page[0]?.id;
          if (!before) break;
          const next = await channel.query({
            messages: { limit: 100, id_lt: before },
          });
          page = next.messages || [];
        }
        if (!cancelled) {
          setLoading(false);
          setError('');
        }
      } catch (failure) {
        if (!cancelled) {
          setError(errorMessage(failure));
          setLoading(false);
        }
      } finally {
        loadingHistory = false;
      }
    };
    historyRetry.current = history;
    void history();
    const recovered = chatClient.on(
      'connection.recovered',
      () => void history(),
    );
    return () => {
      historyRetry.current = undefined;
      cancelled = true;
      subscription.unsubscribe();
      recovered.unsubscribe();
      void channel.stopWatching().catch(() => undefined);
    };
  }, [chatClient, chatError, access.meetingId, accept]);

  const flush = useCallback((): Promise<boolean> => {
    if (sending.current) return sending.current;
    if (!queue.current.length) return Promise.resolve(true);
    if (!chatClient) return Promise.resolve(false);
    const task = async () => {
      setError('');
      try {
        while (queue.current.length && mounted.current) {
          const operation = queue.current[0];
          const response = await api<{ operation: BoardOperation }>(
            `/api/meetings/${access.meetingId}/board`,
            { method: 'POST', body: JSON.stringify(operation) },
          );
          accept(response.operation);
          queue.current.shift();
          persist();
          if (mounted.current) setPending(queue.current.length);
        }
        return queue.current.length === 0;
      } catch (failure) {
        if (mounted.current)
          setError(`Drawing is not synced: ${errorMessage(failure)}`);
        return false;
      } finally {
        sending.current = undefined;
      }
    };
    sending.current = task();
    return sending.current;
  }, [access.meetingId, chatClient, accept, persist]);
  useEffect(() => {
    if (!loading && chatClient) void flush();
  }, [loading, chatClient, flush]);
  const send = useCallback(
    (
      input:
        Omit<BoardOperation, 'actor' | 'time' | 'id'> | Record<string, unknown>,
    ) => {
      const operation = {
        ...input,
        id: crypto.randomUUID(),
        actor: access.identity.id,
        time: new Date().toISOString(),
      };
      if (!validOperation(operation)) return;
      accept(operation);
      queue.current.push(operation);
      persist();
      setPending(queue.current.length);
      void flush();
    },
    [access.identity.id, accept, flush, persist],
  );
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (queue.current.length) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  return {
    operations,
    send,
    loading,
    error,
    pending,
    flush,
    available: !!chatClient,
    retry: () => {
      void historyRetry.current?.();
      void flush();
    },
  };
}
