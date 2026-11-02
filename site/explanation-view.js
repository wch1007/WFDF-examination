export function termNotesView(notes = [], escape) {
  if (!notes.length) return '';
  return `<dl class="term-notes" aria-label="术语释义">${notes.map(({ term, text }) => `<div><dt>${escape(term)}</dt><dd>${escape(text)}</dd></div>`).join('')}</dl>`;
}
