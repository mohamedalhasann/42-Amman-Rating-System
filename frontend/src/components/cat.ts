// No empty avatars: anyone without a photo gets one of the bundled cats, always the same one for the same login.
export const CAT_COUNT = 26;
export function catFor(seed: string | null | undefined) {
  let hash = 0;
  for (const ch of String(seed || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `/cats/cat-${String(hash % CAT_COUNT + 1).padStart(2, '0')}.jpg`;
}
