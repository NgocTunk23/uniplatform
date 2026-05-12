export function getAvatarUrl(imageggid?: string | null): string | null {
  if (!imageggid) return null;

  const trimmed = imageggid.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const driveMatch = trimmed.match(/(?:drive\.google\.com\/.*[?&]id=|\/d\/)([a-zA-Z0-9_-]+)/);
  if (driveMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }

  return `https://lh3.googleusercontent.com/d/${trimmed}`;
}
