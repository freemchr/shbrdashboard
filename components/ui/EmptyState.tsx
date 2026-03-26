import { Inbox, Search, AlertCircle, FolderOpen } from 'lucide-react';

type EmptyVariant = 'default' | 'search' | 'error' | 'jobs';

const variants = {
  default: { icon: FolderOpen,   heading: 'Nothing here',   body: 'No items to display.' },
  search:  { icon: Search,       heading: 'No results found', body: 'Try adjusting your search or filters.' },
  error:   { icon: AlertCircle,  heading: 'Something went wrong', body: 'Could not load data.' },
  jobs:    { icon: Inbox,        heading: 'No jobs',         body: 'No jobs match this criteria.' },
};

interface EmptyStateProps {
  variant?: EmptyVariant;
  heading?: string;
  body?: string;
  className?: string;
}

// ── #3  Empty State — dark card with icon (inspired by 21st.dev Empty States)
export function EmptyState({ variant = 'default', heading, body, className = '' }: EmptyStateProps) {
  const v = variants[variant];
  const Icon = v.icon;
  return (
    <div className={`flex flex-col items-center justify-center py-14 px-6 gap-3 text-center ${className}`}>
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 text-gray-500">
        <Icon size={22} />
      </div>
      <div>
        <p className="text-gray-300 font-semibold text-sm">{heading ?? v.heading}</p>
        <p className="text-gray-500 text-xs mt-1 max-w-[200px]">{body ?? v.body}</p>
      </div>
    </div>
  );
}
