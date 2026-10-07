import { useCallStateHooks } from '@stream-io/video-react-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMeeting } from '@/contexts/MeetProvider';
import { api, BOARD_TYPE, errorMessage } from '@/lib/meeting';
import {
  type BoardOperation,
  validOperation,
  boardBatch,
  canonicalBoardOperations,
} from '@/lib/whiteboard';
import type { MessageResponse, EventTypes } from 'stream-chat';

export default function useWhiteboard() {
  const { useCallCustomData } = useCallStateHooks();
  const custom = useCallCustomData();
  const { access, chatClient, chatError } = useMeeting();
  const [operations, setOperations] = useState<BoardOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(0);
  const liveChannel = useRef<import('stream-chat').Channel | undefined>(
    undefined,
  );
  const liveQueue = useRef<BoardOperation[]>([]);
  const liveSending = useRef(false);
  const frame = useRef<number | undefined>(undefined);
  const previewsStore = useRef(
    new Map<string, { operation: BoardOperation; expires: number }>(),
  );
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
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, []);
  const accept = useCallback((operation: BoardOperation) => {
    previewsStore.current.delete(operation.id);
    stored.current.set(operation.id, operation);
    if (mounted.current && frame.current === undefined)
      frame.current = requestAnimationFrame(() => {
        frame.current = undefined;
        if (mounted.current)
          setOperations(
            [...previewsStore.current.values()]
              .map((value) => value.operation)
              .concat([...stored.current.values()]),
          );
      });
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
    liveChannel.current = channel;
    const read = (message: MessageResponse) => {
      canonicalBoardOperations(
        message.board_operations || message.board_operation,
        message.user?.id || '',
        message.created_at || '',
        message.id,
      ).forEach(accept);
    };
    const previews = channel.on('board_preview' as EventTypes, (event) => {
      if (
        cancelled ||
        !event.user?.id ||
        (custom.collaboration === false && event.user.id !== access.hostId)
      )
        return;
      const values = event.operations;
      if (!Array.isArray(values) || !values.length || values.length > 16)
        return;
      if (
        !values.every(validOperation) ||
        boardBatch(values).length !== values.length ||
        !values.every(
          (value) =>
            value.actor === event.user!.id &&
            (value.kind !== 'clear' || value.actor === access.hostId),
        )
      )
        return;
      values.forEach((value) => {
        if (!stored.current.has(value.id) && previewsStore.current.size < 2000)
          previewsStore.current.set(value.id, {
            operation: {
              ...value,
              time: new Date(event.created_at || Date.now()).toISOString(),
              batch: undefined,
              order: undefined,
            },
            expires: Date.now() + 30000,
          });
      });
      if (mounted.current)
        setOperations(
          [...previewsStore.current.values()]
            .map((value) => value.operation)
            .concat([...stored.current.values()]),
        );
    });
    const subscription = channel.on('message.new', (event) => {
      if (!cancelled && event.message) read(event.message);
    });
    const expiry = setInterval(() => {
      let changed = false;
      for (const [id, value] of previewsStore.current) {
        if (
          value.expires < Date.now() ||
          (custom.collaboration === false &&
            value.operation.actor !== access.hostId)
        ) {
          previewsStore.current.delete(id);
          changed = true;
        }
      }
      if (changed && !cancelled)
        setOperations(
          [...previewsStore.current.values()]
            .map((value) => value.operation)
            .concat([...stored.current.values()]),
        );
    }, 1000);
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
      liveChannel.current = undefined;
      previews.unsubscribe();
      clearInterval(expiry);
      subscription.unsubscribe();
      recovered.unsubscribe();
      void channel.stopWatching().catch(() => undefined);
    };
  }, [
    chatClient,
    chatError,
    access.meetingId,
    custom.collaboration,
    access.hostId,
    accept,
  ]);

  const flush = useCallback((): Promise<boolean> => {
    if (sending.current) return sending.current;
    if (!queue.current.length) return Promise.resolve(true);
    if (!chatClient) return Promise.resolve(false);
    const task = async () => {
      setError('');
      try {
        while (queue.current.length && mounted.current) {
          const batch = boardBatch(queue.current);
          const response = await api<{ operations: BoardOperation[] }>(
            `/api/meetings/${access.meetingId}/board`,
            { method: 'POST', body: JSON.stringify({ operations: batch }) },
          );
          const acknowledged = new Set(
            response.operations.map((operation) => operation.id),
          );
          if (!acknowledged.has(batch[0].id))
            throw new Error('Drawing acknowledgement was invalid.');
          response.operations.forEach(accept);
          queue.current = queue.current.filter(
            (operation) => !acknowledged.has(operation.id),
          );
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
  const preview = useCallback((operation: BoardOperation) => {
    if (!liveChannel.current) return;
    liveQueue.current.push(operation);
    // Slow links cannot grow an unbounded queue of transient HTTP requests.
    // Durable operations are retained independently and recover every segment.
    if (liveQueue.current.length > 256)
      liveQueue.current.splice(0, liveQueue.current.length - 256);
    if (liveSending.current) return;
    liveSending.current = true;
    void (async () => {
      try {
        while (
          mounted.current &&
          liveChannel.current &&
          liveQueue.current.length
        ) {
          const batch = boardBatch(liveQueue.current);
          liveQueue.current.splice(0, batch.length);
          await liveChannel.current
            .sendEvent({
              type: 'board_preview' as EventTypes,
              operations: batch,
            })
            .catch(() => undefined);
          if (liveQueue.current.length)
            await new Promise((resolve) => setTimeout(resolve, 80));
        }
      } finally {
        liveSending.current = false;
      }
    })();
  }, []);
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
      preview(operation);
      queue.current.push(operation);
      persist();
      setPending(queue.current.length);
      void flush();
    },
    [access.identity.id, accept, flush, persist, preview],
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
