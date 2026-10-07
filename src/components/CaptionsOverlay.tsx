import type { CallClosedCaption } from '@stream-io/video-client';
export default function CaptionsOverlay({
  captions,
  running,
  error,
}: {
  captions: CallClosedCaption[];
  running: boolean;
  error: string;
}) {
  return (
    <div
      className="captions-overlay"
      aria-label="Live captions"
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {captions.length ? (
        captions.map((caption) => (
          <div
            key={`${caption.speaker_id}:${caption.start_time}`}
            className="py-1"
          >
            <span className="text-icon-blue font-medium mr-3">
              {caption.user.name || caption.speaker_id}
            </span>
            <span>{caption.text}</span>
          </div>
        ))
      ) : (
        <p className="text-white/70">
          {error ||
            (running
              ? 'Listening for speech…'
              : 'The host needs to start live captions.')}
        </p>
      )}
    </div>
  );
}
