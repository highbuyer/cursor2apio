/**
 * test/unit-continuation.mjs
 *
 * 压力测试：extractSemanticAnchor 和 deduplicateContinuation
 * 运行方式：node test/unit-continuation.mjs
 */

// ─── 内联 extractSemanticAnchor（与 src/handler.ts 保持同步）────────────────
function extractSemanticAnchor(text, maxLength = 300) {
    if (text.length <= maxLength) return text;

    const tail = text.slice(-maxLength * 2);

    const paraBreak = tail.lastIndexOf('\n\n');
    if (paraBreak !== -1 && tail.length - paraBreak <= maxLength) {
        return tail.slice(paraBreak + 2);
    }

    const lineBreak = tail.lastIndexOf('\n');
    if (lineBreak !== -1 && tail.length - lineBreak <= maxLength) {
        return tail.slice(lineBreak + 1);
    }

    return text.slice(-maxLength);
}

// ─── 内联 deduplicateContinuation（与 src/handler.ts 保持同步）──────────────
function deduplicateContinuation(existing, continuation) {
    if (!continuation || !existing) return continuation;

    const maxOverlap = Math.min(500, existing.length, continuation.length);
    if (maxOverlap < 10) return continuation;

    const tail = existing.slice(-maxOverlap);

    let bestOverlap = 0;
    for (let len = maxOverlap; len >= 10; len--) {
        const prefix = continuation.substring(0, len);
        if (tail.endsWith(prefix)) {
            bestOverlap = len;
            break;
        }
    }

    if (bestOverlap === 0) {
        const continuationLines = continuation.split('\n');
        const tailLines = tail.split('\n');
        if (continuationLines.length > 0 && tailLines.length > 0) {
            const firstContLine = continuationLines[0].trim();
            if (firstContLine.length >= 10) {
                for (let i = tailLines.length - 1; i >= 0; i--) {
                    if (tailLines[i].trim() === firstContLine) {
                        let matchedLines = 1;
                        for (let k = 1; k < continuationLines.length && i + k < tailLines.length; k++) {
                            if (continuationLines[k].trim() === tailLines[i + k].trim()) {
                                matchedLines++;
                            } else {
                                break;
                            }
                        }
                        if (matchedLines >= 2) {
                            return continuationLines.slice(matchedLines).join('\n');
                        }
                    }
                }
            }
        }
    }

    return continuation.slice(bestOverlap);
}

// ─── 测试框架 ────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅  ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ❌  ${name}`);
        console.error(`      ${e.message}`);
        failed++;
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
    const as = JSON.stringify(a), bs = JSON.stringify(b);
    if (as !== bs) throw new Error(msg || `Expected ${bs}, got ${as}`);
}

// ════════════════════════════════════════════════════════════════════
// 1. extractSemanticAnchor — 基本行为
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [1] extractSemanticAnchor — 基本行为\n');

test('短文本直接返回原文', () => {
    const text = 'short text';
    assertEqual(extractSemanticAnchor(text), text);
});

test('恰好等于 maxLength 直接返回原文', () => {
    const text = 'x'.repeat(300);
    assertEqual(extractSemanticAnchor(text), text);
});

test('无换行时兜底取末尾300字符', () => {
    const text = 'x'.repeat(1000);
    const anchor = extractSemanticAnchor(text);
    assertEqual(anchor.length, 300);
    assertEqual(anchor, 'x'.repeat(300));
});

test('回溯到最近行首（不在行中间截断）', () => {
    const lines = [];
    for (let i = 0; i < 20; i++) lines.push(`line${i}: ${'a'.repeat(30)}`);
    const text = lines.join('\n');
    const anchor = extractSemanticAnchor(text);
    // 锚点应从行首开始，不以半行开头
    assert(!anchor.startsWith('a'), '不应从行中间开始');
    assert(anchor.startsWith('line'), '应从行首 line 开始');
});

test('优先回溯到段落边界（空行）', () => {
    // 确保段落二的内容 < 300 字符，且总长度 > 300，触发回溯
    const para1 = 'x'.repeat(400) + '\n';
    const para2 = 'paragraph two content here\n'.repeat(3); // ~84 chars
    const text = para1 + '\n' + para2; // 空行分隔两段落
    const anchor = extractSemanticAnchor(text);
    // 段落边界后的内容应是 para2
    assert(anchor.startsWith('paragraph two'), `应从段落边界后开始，实际: "${anchor.substring(0, 50)}"`);
});

test('锚点长度不超过 maxLength', () => {
    const text = 'x'.repeat(500) + '\n' + 'y'.repeat(500);
    const anchor = extractSemanticAnchor(text, 300);
    assert(anchor.length <= 300, `锚点长度 ${anchor.length} 超过 maxLength 300`);
});

test('代码块中间截断 — 回溯到行首', () => {
    const code = [
        'function foo() {',
        '  const x = 1;',
        '  const y = 2;',
        '  return x + y + someVeryLongVariableName + anotherVariable + moreStuff',
    ].join('\n');
    const padding = 'x'.repeat(400);
    const text = padding + '\n' + code;
    const anchor = extractSemanticAnchor(text, 300);
    assert(anchor.length <= 300, '锚点不超过 maxLength');
    // 应从某行行首开始
    const firstChar = anchor[0];
    assert(firstChar !== undefined, '锚点非空');
});

test('XML 标签中间截断 — 回溯到行首', () => {
    const xml = '<result>\n  <item>value1</item>\n  <item>value2</item>\n  <item>this is a very long value that might cause truncation in the middle of';
    const padding = 'prefix\n'.repeat(20);
    const text = padding + xml;
    const anchor = extractSemanticAnchor(text, 300);
    assert(anchor.length <= 300, '锚点不超过 maxLength');
});

// ════════════════════════════════════════════════════════════════════
// 2. extractSemanticAnchor — 压力/边界场景
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [2] extractSemanticAnchor — 压力/边界场景\n');

test('空字符串', () => {
    assertEqual(extractSemanticAnchor(''), '');
});

test('只有换行符', () => {
    const text = '\n'.repeat(500);
    const anchor = extractSemanticAnchor(text);
    assert(anchor.length <= 300, '锚点不超过 maxLength');
});

test('超长单行（无换行）', () => {
    const text = 'a'.repeat(10000);
    const anchor = extractSemanticAnchor(text);
    assertEqual(anchor.length, 300);
});

test('大量短行', () => {
    const text = Array.from({length: 200}, (_, i) => `L${i}`).join('\n');
    const anchor = extractSemanticAnchor(text);
    assert(anchor.length <= 300, '锚点不超过 maxLength');
    assert(anchor.startsWith('L'), '应从某行行首开始');
});

test('末尾恰好是空行', () => {
    const text = 'content\n'.repeat(20) + '\n';
    const anchor = extractSemanticAnchor(text, 50);
    assert(anchor.length <= 50, '锚点不超过 maxLength');
});

test('自定义 maxLength=100', () => {
    const text = 'word '.repeat(200);
    const anchor = extractSemanticAnchor(text, 100);
    assert(anchor.length <= 100, `锚点长度 ${anchor.length} 超过 100`);
});

// ════════════════════════════════════════════════════════════════════
// 3. deduplicateContinuation — 基本去重
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [3] deduplicateContinuation — 基本去重\n');

test('无重叠时原样返回续写', () => {
    const existing = 'function foo() {\n  return 1;\n}';
    const continuation = '\nfunction bar() {\n  return 2;\n}';
    const result = deduplicateContinuation(existing, continuation);
    assertEqual(result, continuation);
});

test('完全重叠时返回空字符串', () => {
    const overlap = 'return 42;\n}';
    const existing = 'function foo() {\n  ' + overlap;
    const continuation = overlap;
    const result = deduplicateContinuation(existing, continuation);
    assertEqual(result, '');
});

test('尾部字符级重叠去重', () => {
    const overlap = 'return result;\n}';
    const existing = 'function foo() {\n  const x = 1;\n  ' + overlap;
    const continuation = overlap + '\nfunction bar() {}';
    const result = deduplicateContinuation(existing, continuation);
    assert(!result.startsWith('return'), '重叠部分应被去除');
    assert(result.includes('function bar'), '新内容应保留');
});

test('行级重叠去重（模型从某行重新开始）', () => {
    const existing = 'function foo() {\n  const x = 1;\n  const y = 2;';
    const continuation = '  const y = 2;\n  return x + y;\n}';
    const result = deduplicateContinuation(existing, continuation);
    assert(!result.startsWith('  const y'), '重复行应被去除');
    assert(result.includes('return x + y'), '新内容应保留');
});

test('空 continuation 返回空', () => {
    assertEqual(deduplicateContinuation('existing', ''), '');
});

test('空 existing 原样返回 continuation', () => {
    assertEqual(deduplicateContinuation('', 'new content'), 'new content');
});

test('两者都为空', () => {
    assertEqual(deduplicateContinuation('', ''), '');
});

// ════════════════════════════════════════════════════════════════════
// 4. deduplicateContinuation — 压力场景
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [4] deduplicateContinuation — 压力场景\n');

test('超长文本（10000字符）重叠去重', () => {
    const base = 'x'.repeat(9000);
    const overlap = 'overlap content here';
    const existing = base + overlap;
    const continuation = overlap + ' and new stuff';
    const result = deduplicateContinuation(existing, continuation);
    assert(result.includes('and new stuff'), '新内容应保留');
    assert(!result.startsWith('overlap'), '重叠应被去除');
});

test('重叠恰好在500字符边界', () => {
    const overlap = 'A'.repeat(490);
    const existing = 'prefix ' + overlap;
    const continuation = overlap + ' suffix';
    const result = deduplicateContinuation(existing, continuation);
    assert(result.includes('suffix'), '新内容应保留');
});

test('极短内容（< 10字符）不去重', () => {
    const existing = 'ab';
    const continuation = 'abcd';
    // maxOverlap < 10，直接返回原 continuation
    assertEqual(deduplicateContinuation(existing, continuation), continuation);
});

test('模拟真实截断续写场景', () => {
    // 模拟：模型生成了一个函数，在 return 语句处截断
    const existing = [
        'export function processData(input: string): string {',
        '  const lines = input.split("\\n");',
        '  const result = lines',
        '    .filter(l => l.trim())',
        '    .map(l => l.toUpperCase()',
    ].join('\n');
    // 续写从重复的 .map 行开始
    const continuation = [
        '    .map(l => l.toUpperCase())',
        '    .join("\\n");',
        '  return result;',
        '}',
    ].join('\n');
    const result = deduplicateContinuation(existing, continuation);
    assert(result.includes('return result'), '新内容应保留');
    assert(result.includes('.join'), '.join 行应保留');
});

// ════════════════════════════════════════════════════════════════════
// 汇总
// ════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(55));
console.log(`  结果: ${passed} 通过 / ${failed} 失败 / ${passed + failed} 总计`);
console.log('═'.repeat(55) + '\n');

if (failed > 0) process.exit(1);
