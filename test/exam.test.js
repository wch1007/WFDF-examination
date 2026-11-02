import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAttempt, isValidAttempt, gradeAttempt, shuffle, chooseAnswer, canVisit } from '../site/exam.js';
const bank = JSON.parse(await readFile(new URL('../site/data/questions.json', import.meta.url)));
const rules = JSON.parse(await readFile(new URL('../site/data/rules.json', import.meta.url)));
function seeded(seed) { return max => { seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b); return (seed >>> 0) % max; }; }

test('题库结构、真实引用、所有最末级条款覆盖', () => {
  const known = new Set(rules.rules.map(r => r.id));
  const covered = new Set(bank.questions.flatMap(q => q.refs));
  assert.equal(new Set(bank.questions.map(q => q.id)).size, bank.questions.length);
  assert.equal(new Set(bank.questions.map(q => q.stem)).size, bank.questions.length);
  for (const q of bank.questions) {
    assert.ok(q.id && q.stem.length > 12 && q.explanation.length > 10, q.id);
    assert.ok(q.chapter >= 1 && q.chapter <= 20, q.id);
    assert.equal(q.options.length, 4, q.id);
    assert.equal(new Set(q.options).size, 4, q.id);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, q.id);
    assert.ok(q.refs.length > 0 && q.refs.every(r => known.has(r)), q.id);
    if (q.termNotes) {
      assert.ok(Array.isArray(q.termNotes), q.id);
      assert.equal(new Set(q.termNotes.map(note => note.term.toLowerCase())).size, q.termNotes.length, q.id);
      assert.ok(q.termNotes.every(note => note.term.trim() && note.text.trim()), q.id);
    }
  }
  const leafRules = [...known].filter(id => ![...known].some(other => other.startsWith(id + '.')));
  assert.deepEqual(leafRules.filter(id => !covered.has(id)), []);
  assert.equal(rules.rules.length, 368);
  assert.equal(rules.definitions.length, 40);
});

test('500 次随机组卷：25 道无重复，20 章齐全，至少 2 道飞盘精神', () => {
  const signatures = new Set();
  for (let seed = 1; seed <= 500; seed++) {
    const a = createAttempt(bank, seeded(seed));
    assert.ok(isValidAttempt(a, bank));
    assert.equal(a.items.length, 25);
    const qs = a.items.map(i => bank.questions.find(q => q.id === i.id));
    assert.equal(new Set(qs.map(q => q.chapter)).size, 20);
    assert.ok(qs.filter(q => q.chapter === 1).length >= 2);
    for (const item of a.items) assert.deepEqual([...item.order].sort(), [0, 1, 2, 3]);
    signatures.add(a.items.map(i => i.id).join(','));
  }
  assert.ok(signatures.size > 450);
});

test('选项洗牌之后按稳定答案计分，未答 0 分', () => {
  const a = createAttempt(bank, seeded(72));
  assert.equal(gradeAttempt(a, bank).score, 0);
  assert.equal(gradeAttempt(a, bank).unanswered, 25);
  a.items.forEach(item => { item.answer = bank.questions.find(q => q.id === item.id).answer; });
  assert.equal(gradeAttempt(a, bank).score, 100);
  assert.equal(gradeAttempt(a, bank).unanswered, 0);
  a.items[0].answer = (a.items[0].answer + 1) % 4;
  a.items[1].answer = null;
  assert.equal(gradeAttempt(a, bank).score, 92);
  assert.equal(gradeAttempt(a, bank).correct, 23);
  assert.equal(gradeAttempt(a, bank).unanswered, 1);
});

test('存档 JSON 往返保留答题、选项顺序与标记', () => {
  const a = createAttempt(bank, seeded(123));
  a.items[8].answer = 2; a.items[8].flagged = true; a.current = 8;
  const restored = JSON.parse(JSON.stringify(a));
  assert.ok(isValidAttempt(restored, bank));
  assert.deepEqual(restored, a);
});

test('拒绝版本过期、重复题目、非法选项或损坏存档', () => {
  const a = createAttempt(bank, seeded(9));
  assert.equal(isValidAttempt(null, bank), false);
  assert.equal(isValidAttempt({}, bank), false);
  for (const mutate of [a => a.revision = 'old', a => a.current = 25, a => a.items[0].answer = 4, a => a.items[0].order = [0,0,1,2], a => a.items[1] = a.items[0], a => a.items[0].id = 'missing']) {
    const broken = structuredClone(a); mutate(broken); assert.equal(isValidAttempt(broken, bank), false);
  }
});

test('洗牌不改动输入，并可将正确选项移出首位', () => {
  const original = [0, 1, 2, 3]; const result = shuffle(original, () => 0);
  assert.deepEqual(original, [0,1,2,3]); assert.deepEqual(result, [1,2,3,0]);
});

test('即时判题后锁定首次答案，完成本题才解锁下一题', () => {
  const a = createAttempt(bank, seeded(42));
  assert.equal(canVisit(a, 0), true);
  assert.equal(canVisit(a, 1), false);
  assert.equal(chooseAnswer(a, 2), true);
  assert.equal(chooseAnswer(a, 0), false);
  assert.equal(a.items[0].answer, 2);
  assert.equal(canVisit(a, 1), true);
  assert.equal(canVisit(a, 2), false);
  a.completedAt = Date.now();
  assert.equal(chooseAnswer(a, 1), false);
});
