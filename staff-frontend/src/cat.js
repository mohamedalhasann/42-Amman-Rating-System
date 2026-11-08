// No empty avatars: anyone without a photo gets one of the bundled cat memes, always the same one for the same login.
export const CAT_COUNT = 14;
export function catFor(seed) {
  // FNV-1a with a final mix, so similar logins still land on different memes
  let hash = 2166136261;
  for (const ch of String(seed || '')) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x85ebca6b) >>> 0; hash = (hash ^ (hash >>> 13)) >>> 0;
  return `/cats/cat-${String(hash % CAT_COUNT + 1).padStart(2, '0')}.jpg`;
}
