export function getAvatarUrl(imageggid?: string | null): string | null {
  if (!imageggid) return null;

  let finalAvatarUrl = imageggid;

  // Trường hợp 1: Trong DB lỡ lưu cái link cũ có chữ drive.google.com
  if (imageggid.includes('drive.google.com')) {
    const match = imageggid.match(/id=([^&]+)/);
    if (match && match[1]) {
      finalAvatarUrl = `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  } 
  // Trường hợp 2: DB chỉ lưu mỗi cái ID nguyên chất
  else if (!imageggid.startsWith('http') && !imageggid.startsWith('data:')) {
    finalAvatarUrl = `https://lh3.googleusercontent.com/d/${imageggid}`;
  }

  return finalAvatarUrl;
}