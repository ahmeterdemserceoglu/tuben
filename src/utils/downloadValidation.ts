/** Decode a small binary prefix without depending on Node's Buffer. */
export function decodeMediaPrefix(base64: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bits = 0, value = 0, result = '';
  for (const char of base64) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) continue;
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) { bits -= 8; result += String.fromCharCode((value >> bits) & 255); }
  }
  return result;
}

export function validateMediaPrefix(prefix: string, mp4: boolean): void {
  if (/^\s*(?:<!doctype|<html|<head|<body|<\?xml)/i.test(prefix)) {
    throw new Error('Sunucu medya yerine hata sayfası döndürdü.');
  }
  if (mp4 && !['ftyp', 'styp'].includes(prefix.slice(4, 8))) {
    throw new Error('İndirilen dosya geçerli bir MP4 değil.');
  }
}

export function validateDownloadHeaders(headers: Record<string, string> = {}): void {
  const contentType = Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1] || '';
  if (/(?:text\/(?:html|plain)|(?:application\/)?(?:json|xml))/i.test(contentType)) {
    throw new Error('Sunucu medya yerine hata yanıtı döndürdü.');
  }
}
