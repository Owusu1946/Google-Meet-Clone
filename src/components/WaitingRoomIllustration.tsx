import Image from 'next/image';

export default function WaitingRoomIllustration() {
  return (
    <Image
      src="/waiting-room-dark.avif"
      alt=""
      width={1800}
      height={1080}
      className="waiting-illustration"
      unoptimized
    />
  );
}
