"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { BackgroundFiltersProvider, CallingState, StreamCall, StreamVideo, StreamVideoClient } from '@stream-io/video-react-sdk';
import { StreamChat, type Channel } from 'stream-chat';
import { api, CALL_TYPE, CHAT_TYPE, errorMessage, type MeetingAccess } from '@/lib/meeting';
import LoadingOverlay from '@/components/LoadingOverlay';

export { CALL_TYPE } from '@/lib/meeting';
export const API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY || '';
type Session = { access: MeetingAccess; chatClient?: StreamChat; channel?: Channel; chatError: string };
const MeetContext = createContext<Session | null>(null);
export function useMeeting() {
  const context = useContext(MeetContext);
  if (!context) throw new Error('Meeting context is unavailable.');
  return context;
}

export default function MeetProvider({ meetingId, children }: { meetingId: string; children: ReactNode }) {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<Session>();
  const [video, setVideo] = useState<StreamVideoClient>();
  const [activeCall, setActiveCall] = useState<ReturnType<StreamVideoClient['call']>>();
  const [error, setError] = useState('');
  const userId = user?.id;

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    const abort = new AbortController();
    let videoClient: StreamVideoClient | undefined;
    let chatClient: StreamChat | undefined;
    let call: ReturnType<StreamVideoClient['call']> | undefined;
    setError('');
    setSession(undefined);
    const setup = async () => {
      const access = await api<MeetingAccess>(`/api/meetings/${meetingId}/access`, { method: 'POST', body: '{}', signal: abort.signal });
      if (cancelled) return;
      if (access.status !== 'ready' || !access.token) { router.replace(`/${meetingId}`); return; }
      const tokenProvider = async () => (await api<{ token: string }>('/api/token', { method: 'POST', body: JSON.stringify({ meetingId }) })).token;
      videoClient = new StreamVideoClient({ apiKey: API_KEY, user: { id: access.identity.id, name: access.identity.name, image: access.identity.image }, token: access.token, tokenProvider });
      call = videoClient.call(CALL_TYPE, meetingId);
      await call.get();
      if (cancelled) return;
      await call.join();
      if (cancelled) return;
      // Device preferences survive lobby navigation and reload; denied devices do not block joining.
      const settings = JSON.parse(localStorage.getItem('meet-devices') || '{}') as { mic?: boolean; camera?: boolean; audioId?: string; videoId?: string; speakerId?: string };
      const media = async () => {
        if (settings.audioId) await call!.microphone.select(settings.audioId);
        if (settings.videoId) await call!.camera.select(settings.videoId);
        if (settings.speakerId) await call!.speaker.select(settings.speakerId);
        await Promise.allSettled([settings.mic ? call!.microphone.enable() : call!.microphone.disable(), settings.camera ? call!.camera.enable() : call!.camera.disable()]);
      };
      await media().catch(() => undefined);
      if (cancelled) return;
      call.updateClosedCaptionSettings({ visibilityDurationMs: 6000, maxVisibleCaptions: 3 });
      setVideo(videoClient);
      setActiveCall(call);
      setSession({ access, chatError: '' });
      try {
        chatClient = new StreamChat(API_KEY);
        await chatClient.connectUser({ id: access.identity.id, name: access.identity.name, image: access.identity.image }, tokenProvider);
        if (cancelled) return;
        const channel = chatClient.channel(CHAT_TYPE, meetingId);
        await channel.watch();
        if (!cancelled) setSession({ access, chatClient, channel, chatError: '' });
      } catch (chatFailure) {
        if (!cancelled) setSession({ access, chatError: errorMessage(chatFailure) });
      }
    };
    const pending = setup().catch(failure => { if (!cancelled) setError(errorMessage(failure)); });
    return () => {
      cancelled = true;
      abort.abort();
      // Wait for in-flight joins/connects before releasing clients; Strict Mode cannot leave an orphan session.
      void pending.finally(async () => {
        if (call && call.state.callingState !== CallingState.LEFT) await call.leave().catch(() => undefined);
        await Promise.allSettled([videoClient?.disconnectUser(), chatClient?.disconnectUser()]);
      });
    };
  }, [isLoaded, userId, meetingId, attempt, router]);

  if (error) return <main className="min-h-svh grid place-items-center p-6"><div className="text-center space-y-5 max-w-md"><h1 className="text-2xl">Could not connect</h1><p role="alert">{error}</p><button className="primary-button" onClick={() => setAttempt(value => value + 1)}>Try again</button><a className="block text-primary" href={`/${meetingId}`}>Return to lobby</a></div></main>;
  if (!session || !video || !activeCall) return <LoadingOverlay />;
  return <MeetContext.Provider value={session}><StreamVideo client={video}><StreamCall call={activeCall}><BackgroundFiltersProvider>{children}</BackgroundFiltersProvider></StreamCall></StreamVideo></MeetContext.Provider>;
}
