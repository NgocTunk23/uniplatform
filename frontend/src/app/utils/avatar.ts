export function getAvatarUrl(imageggid?: string | null): string | null {
  if (!imageggid) return null;

  const trimmed = imageggid.trim();
  if (!trimmed) return null;
  
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const driveMatch = trimmed.match(/(?:drive\.google\.com\/.*[?&]id=|\/d\/)([a-zA-Z0-9_-]+)/);
  const fileId = driveMatch?.[1] || trimmed;

  // Nếu là số ID ngắn gọn của Profile (như 1, 2, 9...)
  if (fileId.length < 10) {
    return `http://googleusercontent.com/profile/picture/${fileId}`;
  }

  // Nếu là chuỗi dài của Google Drive, dùng lh3.googleusercontent để bypass CORS
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}