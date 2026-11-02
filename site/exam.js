export const EXAM_SIZE = 25;
export const POINTS = 4;

export function randomInt(max) {
  if (!Number.isSafeInteger(max) || max < 1 || max > 0x100000000) throw new RangeError('Invalid random range');
  const limit = 0x100000000 - (0x100000000 % max);
  const value = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % max;
}

export function shuffle(items, rng = randomInt) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createAttempt(bank, rng = randomInt, now = Date.now()) {
  const chosen = [];
  for (let chapter = 1; chapter <= 20; chapter++) {
    const pool = bank.questions.filter(q => q.chapter === chapter);
    if (!pool.length) throw new Error(`第 ${chapter} 章缺少题目`);
    chosen.push(pool[rng(pool.length)]);
  }
  const spirit = bank.questions.filter(q => q.chapter === 1 && !chosen.includes(q));
  if (!spirit.length) throw new Error('飞盘精神题目不足');
  chosen.push(spirit[rng(spirit.length)]);
  const rest = shuffle(bank.questions.filter(q => !chosen.includes(q)), rng);
  chosen.push(...rest.slice(0, EXAM_SIZE - chosen.length));
  if (chosen.length !== EXAM_SIZE) throw new Error('题库题目不足');
  return {
    schema: 1, revision: bank.revision, id: globalThis.crypto.randomUUID(),
    startedAt: now, completedAt: null, current: 0,
    items: shuffle(chosen, rng).map(q => ({ id: q.id, order: shuffle(q.options.map((_, i) => i), rng), answer: null, flagged: false }))
  };
}

export function isValidAttempt(attempt, bank) {
  if (!attempt || attempt.schema !== 1 || attempt.revision !== bank.revision || typeof attempt.id !== 'string' || !Number.isFinite(attempt.startedAt) || !Number.isInteger(attempt.current) || attempt.current < 0 || attempt.current >= EXAM_SIZE || !Array.isArray(attempt.items) || attempt.items.length !== EXAM_SIZE || new Set(attempt.items.map(x => x?.id)).size !== EXAM_SIZE) return false;
  if (attempt.completedAt !== null && (!Number.isFinite(attempt.completedAt) || attempt.completedAt < attempt.startedAt)) return false;
  const questions = new Map(bank.questions.map(q => [q.id, q]));
  return attempt.items.every(item => {
    const q = questions.get(item?.id);
    return q && typeof item.flagged === 'boolean' && Array.isArray(item.order) && item.order.length === q.options.length && new Set(item.order).size === q.options.length && item.order.every(n => Number.isInteger(n) && n >= 0 && n < q.options.length) && (item.answer === null || Number.isInteger(item.answer) && item.answer >= 0 && item.answer < q.options.length);
  });
}

export function gradeAttempt(attempt, bank) {
  if (!isValidAttempt(attempt, bank)) throw new Error('试卷已失效，请重新开始');
  const questions = new Map(bank.questions.map(q => [q.id, q]));
  const results = attempt.items.map(item => {
    const question = questions.get(item.id);
    return { ...item, question, correct: item.answer === question.answer };
  });
  const correct = results.filter(r => r.correct).length;
  return { correct, score: correct * POINTS, unanswered: results.filter(r => r.answer === null).length, total: results.length, results };
}

// A submitted answer is immutable. Feedback must not let a later click alter the score.
export function chooseAnswer(attempt, answer) {
  if (!attempt || attempt.completedAt !== null || !Number.isInteger(answer) || answer < 0 || answer > 3) return false;
  const item = attempt.items[attempt.current];
  if (!item || item.answer !== null) return false;
  item.answer = answer;
  return true;
}

export function canVisit(attempt, index) {
  if (!Number.isInteger(index) || index < 0 || index >= EXAM_SIZE) return false;
  const firstPending = attempt.items.findIndex(i => i.answer === null);
  return firstPending === -1 || index <= firstPending || attempt.items[index].answer !== null;
}
