import { readFile, writeFile } from 'node:fs/promises';
const bank = JSON.parse(await readFile('site/data/questions.json', 'utf8'));
const rules = JSON.parse(await readFile('site/data/rules.json', 'utf8'));
const ids = rules.rules.map(r => r.id);
const direct = Object.fromEntries(ids.map(id => [id, bank.questions.filter(q => q.refs.includes(id)).map(q => q.id)]));
const leaves = ids.filter(id => !ids.some(other => other.startsWith(id + '.')));
const result = {
  edition: rules.edition, revision: bank.revision, questions: bank.questions.length,
  numberedEntries: ids.length, leafClauses: leaves.length,
  directlyCoveredLeafClauses: leaves.filter(id => direct[id].length).length,
  chapters: rules.chapters.map(c => ({ id: c.id, title: c.title, questions: bank.questions.filter(q => q.chapter === c.id).length })),
  clauses: Object.fromEntries(ids.map(id => [id, { direct: direct[id], viaChildren: bank.questions.filter(q => q.refs.some(ref => ref.startsWith(id + '.'))).map(q => q.id).sort() }])),
  uncoveredLeaves: leaves.filter(id => !direct[id].length),
  note: 'direct 表示实际引用；viaChildren 表示子条款覆盖。标题、引导句和实质条款分别列出，不用父条款自动充当末级条款覆盖。定义完整收录在规则库，相关概念用于情境题。'
};
await writeFile('site/data/coverage.json', JSON.stringify(result, null, 2) + '\n');
console.log(`${result.questions} questions; ${result.directlyCoveredLeafClauses}/${result.leafClauses} leaf clauses directly covered`);
