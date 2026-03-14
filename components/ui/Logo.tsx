import Image from 'next/image';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src="/shbr-logo.png"
        alt="SHBR Group"
        width={140}
        height={54}
        priority
        unoptimized
      />
    </div>
  );
}
