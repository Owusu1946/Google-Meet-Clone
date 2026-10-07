import { StreamClient } from '@stream-io/node-sdk';
import { StreamChat } from 'stream-chat';

// SDK errors can contain HTTP authorization headers. Never dump request objects.
process.on('uncaughtException', (error) => {
  console.error(`Stream setup failed: ${error.message.slice(0, 250)}`);
  process.exitCode = 1;
});

const key = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const secret = process.env.STREAM_API_SECRET;
if (!key || !secret)
  throw new Error('Configure Stream credentials in .env first.');
const video = new StreamClient(key, secret, { timeout: 30_000 }).video;
const chat = new StreamChat(key, secret, { timeout: 30_000 });
const defaults = (await video.getCallType({ name: 'default' })).settings;
const member = [
  'read-call',
  'join-call',
  'send-audio',
  'send-video',
  'screenshare',
  'send-event',
  'create-call-reaction',
];
const host = [
  ...member,
  'mute-users',
  'block-user',
  'kick-user',
  'end-call',
  'pin-call-track',
  'list-recordings',
  'start-recording',
  'stop-recording',
  'start-closed-captions',
  'stop-closed-captions',
];
const videoConfig = {
  grants: { user: [], guest: [], call_member: member, host },
  settings: {
    ...defaults,
    audio: {
      ...defaults.audio,
      mic_default_on: false,
      default_device: 'speaker',
    },
    video: { ...defaults.video, camera_default_on: false },
    recording: { mode: 'available', quality: '720p' },
    transcription: {
      mode: 'available',
      closed_caption_mode: 'available',
      language: 'en',
    },
  },
};
const existing = await video.listCallTypes();
if (!Object.hasOwn(existing.call_types, 'meet')) {
  await video.createCallType({ name: 'meet', ...videoConfig });
}
await video.updateCallType({ name: 'meet', ...videoConfig });
for (const [name, write] of [
  ['meet-chat', true],
  ['meet-board', false],
  ['meet-requests', false],
]) {
  const config = {
    grants: {
      user: [],
      guest: [],
      channel_member: [
        'read-channel',
        'read-channel-members',
        ...(write
          ? [
              'create-message',
              'create-reply',
              'update-message-owner',
              'delete-message-owner',
              'send-custom-event',
              'add-links',
            ]
          : name === 'meet-board'
            ? ['send-custom-event']
            : []),
      ],
    },
    custom_events: true,
    typing_events: write,
    read_events: write,
    replies: write,
    reactions: false,
    uploads: false,
    commands: [],
    max_message_length: 20000,
    automod: 'disabled',
    automod_behavior: 'flag',
    message_retention: 'infinite',
  };
  try {
    await chat.getChannelType(name);
  } catch (error) {
    if (error.status !== 404 && error.code !== 16) throw error;
    await chat.createChannelType({ name, ...config });
  }
  await chat.updateChannelType(name, config);
}
console.log(
  'Configured meet, meet-chat, meet-board, and meet-requests. Existing default/messaging types were preserved.',
);
