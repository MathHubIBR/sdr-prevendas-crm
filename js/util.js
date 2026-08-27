// Utilitários compartilhados entre as telas.
const CHANNELS = [
  { value: 'ligacao', label: 'Ligação' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'outro', label: 'Outro' },
];

const RESULTS = [
  { value: 'sem_contato', label: 'Sem contato' },
  { value: 'contato_feito', label: 'Contato feito' },
  { value: 'agendado', label: 'Agendado' },
  { value: 'recusado', label: 'Recusado' },
];

const STAGES = [
  'Prospecção',
  'Qualificação',
  'Reunião Agendada',
  'Proposta',
  'Negociação',
  'Ganho',
  'Perdido',
];

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

function nowLocalDateTime() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16).replace('T', ' ');
}

function formatDateBR(isoDate) {
  if (!isoDate) return '';
  const datePart = isoDate.slice(0, 10);
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function formatDateTimeBR(isoDateTime) {
  if (!isoDateTime) return '';
  const [datePart, timePart] = isoDateTime.split(' ');
  const dateBR = formatDateBR(datePart);
  return timePart ? `${dateBR} ${timePart}` : dateBR;
}

function daysDiffFromToday(isoDate) {
  const today = new Date(todayISO() + 'T00:00:00');
  const target = new Date(isoDate.slice(0, 10) + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function channelLabel(value) {
  const c = CHANNELS.find((c) => c.value === value);
  return c ? c.label : (value || '');
}

function resultLabel(value) {
  const r = RESULTS.find((r) => r.value === value);
  return r ? r.label : (value || '');
}

function formatMoney(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (Number.isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

function qs(sel, root) {
  return (root || document).querySelector(sel);
}

function qsa(sel, root) {
  return Array.from((root || document).querySelectorAll(sel));
}
