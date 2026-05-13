import React from 'react';

interface AvatarWithFallbackProps {
  url: string | null;
  name: string;
  role?: string;
  size?: string;
  textSize?: string;
}

export function AvatarWithFallback({ 
  url, 
  name, 
  role, 
  size = "w-10 h-10", 
  textSize = "text-xs" 
}: AvatarWithFallbackProps) {
  const [error, setError] = React.useState(false);

  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (url && !error) {
    return (
      <div className={`${size} rounded-full border-2 border-white shadow-sm overflow-hidden shrink-0`}>
        <img
          src={url}
          alt={`${name} avatar`}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${size} rounded-full bg-purple-200 border-2 border-white shadow-sm flex items-center justify-center text-purple-700 font-semibold ${textSize} shrink-0`}>
      {initials}
    </div>
  );
}
