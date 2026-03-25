export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-8 h-8 border-2 border-gray-700 border-t-red-500 rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-900 bg-red-950/20 p-6 text-center">
      <p className="text-red-400 font-medium">Error</p>
      <p className="text-gray-400 text-sm mt-1">{message}</p>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="w-24 h-3 bg-gray-800 rounded animate-pulse" />
      <div className="w-16 h-8 bg-gray-800 rounded animate-pulse mt-2" />
      <div className="w-32 h-2 bg-gray-800 rounded animate-pulse mt-1" />
    </div>
  );
}

export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="bg-gray-800/50 h-10 w-full" />
        {[...Array(rows)].map((_, i) => (
          <div
            key={i}
            className={`h-12 flex items-center px-4 gap-4 ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800/20'}`}
          >
            <div className="h-3 bg-gray-700 rounded animate-pulse w-1/4" />
            <div className="h-3 bg-gray-700 rounded animate-pulse w-1/4" />
            <div className="h-3 bg-gray-700 rounded animate-pulse w-1/4" />
            <div className="h-3 bg-gray-700 rounded animate-pulse w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
