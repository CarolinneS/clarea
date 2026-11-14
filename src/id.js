// Identificadores únicos (D-012). UUID versão 4; não dependem de relógio nem da ordem de criação.
/** `cripto` existe só para testar os planos B; no app usa o `crypto` do navegador. */
export function novoId(cripto = globalThis.crypto) {
  if (cripto && typeof cripto.randomUUID === 'function') return cripto.randomUUID();
  const b = new Uint8Array(16);
  if (cripto && typeof cripto.getRandomValues === 'function') cripto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; // versão 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
