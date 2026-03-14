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
