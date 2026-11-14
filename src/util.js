// Utilidades puras de texto e data. Nada aqui lê a tela nem o estado do app.
export const TYPES = [['esperando', 'Esperando'], ['retomar', 'Retomar'], ['confirmar', 'Confirmar'], ['conversar', 'Conversar'], ['fazer', 'Fazer']];
export const typeLabel = (k) => (TYPES.find((t) => t[0] === k) || [])[1] || '';
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
export const diffDays = (a, b) => { const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number); return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5); };
/** Idade em dias de um assunto. `hoje` é a data de hoje (AAAA-MM-DD). */
export const ageOf = (i, hoje) => Math.max(0, diffDays(i.created, hoje));
export const ageText = (a) => (a <= 0 ? 'hoje' : a === 1 ? 'há 1 dia' : `há ${a} dias`);
export const ageCls = (a) => (a <= 2 ? '' : a <= 4 ? 'w' : 'a');
export const horaLabel = (h) => { const [hh, mm] = (h || '18:00').split(':'); return mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`; };
export const dateShort = (s, hoje) => { const [, m, d] = (s || hoje).split('-'); return `${d}/${m}`; };
export const initials = (n) => norm(n).replace(/[^a-z]/g, '').slice(0, 2).toUpperCase() || '·';
export const avaCls = (n) => { let h = 0; for (const c of norm(n)) h = (h * 31 + c.charCodeAt(0)) % 997; return 'c' + (h % 3); };
export const fmt1 = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
