export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#DC2626" />
        {/* Building */}
        <rect x="7" y="14" width="18" height="14" fill="white" opacity="0.9" />
        <rect x="10" y="18" width="4" height="4" fill="#DC2626" />
        <rect x="18" y="18" width="4" height="4" fill="#DC2626" />
        <rect x="13" y="22" width="6" height="6" fill="#DC2626" />
        {/* Roof / Flame peak */}
        <polygon points="16,2 24,14 8,14" fill="white" />
        <polygon points="16,5 21,14 11,14" fill="#DC2626" opacity="0.3" />
      </svg>
      <span className="font-bold text-white text-lg tracking-wide">
        SHBR <span className="text-red-500">GROUP</span>
      </span>
    </div>
  );
}
