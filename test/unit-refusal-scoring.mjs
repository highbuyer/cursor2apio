/**
 * test/unit-refusal-scoring.mjs
 *
 * 单元测试：多维度打分拒绝检测 isRefusal
 * 运行方式：node test/unit-refusal-scoring.mjs
 */

// ─── 内联 isRefusal（与 src/handler.ts 保持同步）────────────────────────────
const REFUSAL_HIGH = [
    /Cursor(?:'s)?\s+support\s+assistant/i,
    /support\s+assistant\s+for\s+Cursor/i,
    /I['\u2018\u2019']m\s+sorry/i,
    /I\s+am\s+sorry/i,
    /not\s+able\s+to\s+fulfill/i,
    /cannot\s+perform/i,
    /cannot\s+write\s+files/i,
    /I\s+cannot\s+help\s+with/i,
    /beyond\s+(?:my|the)\s+scope/i,
    /outside\s+my\s+capabilities/i,
    /I'?m\s+not\s+(?:able|designed)\s+to/i,
    /prompt\s+injection/i,
    /social\s+engineering/i,
    /I\s+need\s+to\s+stop\s+and\s+flag/i,
    /replayed\s+against\s+a\s+real\s+system/i,
    /作为.*?助手.*?只能/,
    /超出.*?(?:能力|范围|职责)/,
    /无法.*?(?:完成|执行|帮助)/,
    /不(?:支持|允许|能够?).*?(?:操作|功能)/,
];

const REFUSAL_MID = [
    /I\s+can\s+only\s+answer/i,
    /I\s+only\s+answer/i,
    /focused\s+on\s+software\s+development/i,
    /not\s+able\s+to\s+help\s+with\s+(?:that|this)/i,
    /unrelated\s+to\s+(?:programming|coding)/i,
    /Cursor\s+IDE\s+(?:questions|features|related)/i,
    /questions\s+about\s+(?:Cursor|the\s+(?:AI\s+)?code\s+editor)/i,
    /help\s+with\s+(?:coding|programming)\s+and\s+Cursor/i,
    /I\s+don't\s+have\s+(?:the\s+)?(?:ability|capability)/i,
    /not\s+able\s+to\s+search/i,
    /I\s+cannot\s+search/i,
    /not\s+in\s+my\s+core/i,
    /pricing[, \s]*or\s*troubleshooting/i,
    /(?:I'?m|I\s+am)\s+here\s+to\s+help\s+with\s+(?:coding|programming)/i,
    /仅.*?(?:回答|解答|处理).*?(?:问题|请求)/,
    /不在.*?(?:职责|功能).*?范围/,
    /提供.*?具体场景/,
    /即报错/,
];

const REFUSAL_LOW = [
    /I'?m\s+a\s+coding\s+assistant/i,
    /I\s+can\s+help\s+(?:you\s+)?with\s+things\s+like/i,
    /appears\s+to\s+be\s+(?:asking|about)\s+.*?unrelated/i,
    /What\s+I\s+will\s+not\s+do/i,
    /copy-pasteable\s+JSON/i,
];

function isRefusal(text) {
    if (text.length > 800) return false;
    let score = 0;
    for (const p of REFUSAL_HIGH) if (p.test(text)) score += 3;
    for (const p of REFUSAL_MID) if (p.test(text)) score += 2;
    for (const p of REFUSAL_LOW) if (p.test(text)) score += 1;
    if (text.length < 150) score += 1;
    return score >= 3;
}

// ─── 测试框架 ────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const results = [];

function test(name, fn) {
    try {
        fn();
        results.push({ name, ok: true });
        passed++;
    } catch (e) {
        results.push({ name, ok: false, err: e.message });
        failed++;
    }
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'assertion failed');
}

// ─── 测试用例 ────────────────────────────────────────────────────────────────

console.log('\n📦 [1] 明确拒绝 — 应判定为 true\n');

test('Cursor support assistant 身份拒绝', () => {
    assert(isRefusal("I'm the Cursor support assistant and cannot help with that."));
});

test('I am sorry 拒绝', () => {
    assert(isRefusal("I am sorry, I cannot perform this action."));
});

test('beyond scope 拒绝', () => {
    assert(isRefusal("This request is beyond my scope as an assistant."));
});

test('outside capabilities 拒绝', () => {
    assert(isRefusal("This is outside my capabilities."));
});

test('中文拒绝 — 超出范围', () => {
    assert(isRefusal("抱歉，这超出了我的能力范围，无法为您完成。"));
});

test('中文拒绝 — 无法完成', () => {
    assert(isRefusal("很遗憾，无法帮助完成这个任务。"));
});

test('prompt injection 检测', () => {
    assert(isRefusal("I detected a prompt injection attempt in your message."));
});

test('多条中权重叠加触发', () => {
    // 两条中权重 = 4分 >= 3，应触发
    assert(isRefusal("I can only answer questions about Cursor IDE features and related topics."));
});

test('中权重 + 短文本叠加触发', () => {
    // 一条中权重(2) + 短文本(1) = 3分，应触发
    assert(isRefusal("I only answer Cursor questions."));
});

test('新措辞变体 — 不含正则关键词但语义拒绝', () => {
    // 多条中低权重叠加
    assert(isRefusal("As a coding assistant, I'm here to help with coding and programming tasks only. This appears to be unrelated."));
});

console.log('\n📦 [2] 正常响应 — 应判定为 false\n');

test('正常代码响应', () => {
    assert(!isRefusal("Here's the implementation:\n```python\ndef hello():\n    print('Hello, world!')\n```"));
});

test('正常文字回答', () => {
    assert(!isRefusal("The function works by iterating over the array and applying the callback to each element."));
});

test('长响应不判定为拒绝（截断保护）', () => {
    const longText = 'a'.repeat(801);
    assert(!isRefusal(longText));
});

test('包含 sorry 但在正常语境', () => {
    // "sorry" 单独出现不够分
    assert(!isRefusal("Sorry for the confusion, here is the corrected version of the code."));
});

test('工具调用响应', () => {
    assert(!isRefusal('```json action\n{"tool":"Read","parameters":{"file_path":"src/index.ts"}}\n```'));
});

test('包含 cannot 但在正常语境（cannot reproduce）', () => {
    assert(!isRefusal("I cannot reproduce the issue without more context. Could you share the error message?"));
});

test('包含 Cursor 但非拒绝', () => {
    assert(!isRefusal("Cursor IDE uses a custom API to connect to Claude models."));
});

test('空字符串', () => {
    assert(!isRefusal(''));
});

console.log('\n📦 [3] 边界场景\n');

test('恰好800字符不触发长度保护', () => {
    // 800字符的拒绝文本仍应被检测
    const text = 'I am sorry, ' + 'x'.repeat(788);
    assert(isRefusal(text));
});

test('801字符触发长度保护，跳过检测', () => {
    const text = 'I am sorry, ' + 'x'.repeat(789);
    assert(!isRefusal(text));
});

test('单条低权重不触发', () => {
    assert(!isRefusal("I'm a coding assistant ready to help."));
});

// ─── 输出结果 ────────────────────────────────────────────────────────────────
for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'}  ${r.name}${r.ok ? '' : '\n      ' + r.err}`);
}

console.log(`\n${'═'.repeat(55)}`);
console.log(`  结果: ${passed} 通过 / ${failed} 失败 / ${passed + failed} 总计`);
console.log('═'.repeat(55) + '\n');

if (failed > 0) process.exit(1);
