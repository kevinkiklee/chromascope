import Image from 'next/image';

export function ProductScreenshot({
  src,
  alt,
  placeholder = 'Product screenshot',
  className = '',
}: {
  src?: string;
  alt: string;
  placeholder?: string;
  className?: string;
}) {
  if (src) {
    return (
      <div className={`rounded-xl border border-white/[0.06] bg-zinc-900/50 overflow-hidden ${className}`}>
        <Image
          src={src}
          alt={alt}
          width={800}
          height={500}
          className="w-full h-auto"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-white/[0.06] bg-zinc-900/50 flex items-center justify-center ${className}`}
    >
      <div className="text-center py-4">
        <div className="text-zinc-600 text-sm">[ {placeholder} ]</div>
        <div className="text-zinc-700 text-xs mt-1">{alt}</div>
      </div>
    </div>
  );
}
