/**
 * test/unit-dynamic-fewshot.mjs
 *
 * 单元测试：getLastUsedToolName 动态 few-shot 工具提取
 * 运行方式：node test/unit-dynamic-fewshot.mjs
 */

// ─── 内联 getLastUsedToolName（与 src/converter.ts 保持同步）────────────────
function getLastUsedToolName(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== 'assistant') continue;
        if (!Array.isArray(msg.content)) continue;
        for (const block of msg.content) {
            if (block.type === 'tool_use' && block.name) {
                return block.name;
            }
        }
    }
    return null;
}

// ─── 测试框架 ────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
    if (!condition) throw new Error(message || 'assertion failed');
}

function assertEqual(a, b) {
    if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function test(label, fn) {
    try {
        fn();
        console.log(`  ✅  ${label}`);
        passed++;
    } catch (e) {
        console.log(`  ❌  ${label}`);
        console.log(`      ${e.message}`);
        failed++;
        failures.push({ label, error: e.message });
    }
}

// ─── 测试用例 ─────────────────────────────────────────────────────────────────

console.log('\n📦 [1] 基本提取\n');

test('空消息列表返回 null', () => {
    assertEqual(getLastUsedToolName([]), null);
});

test('无工具调用历史返回 null', () => {
    const messages = [
        { role: 'user', content: [{ type: 'text', text: 'hello' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
    ];
    assertEqual(getLastUsedToolName(messages), null);
});

test('单次工具调用返回工具名', () => {
    const messages = [
        { role: 'user', content: [{ type: 'text', text: 'read the file' }] },
        { role: 'assistant', content: [
            { type: 'tool_use', name: 'Read', id: 'tu_1', input: { file_path: 'src/index.ts' } }
        ]},
    ];
    assertEqual(getLastUsedToolName(messages), 'Read');
});

test('多次工具调用返回最近一次', () => {
    const messages = [
        { role: 'user', content: [{ type: 'text', text: 'do stuff' }] },
        { role: 'assistant', content: [
            { type: 'tool_use', name: 'Read', id: 'tu_1', input: {} }
        ]},
        { role: 'user', content: [
            { type: 'tool_result', tool_use_id: 'tu_1', content: 'file content' }
        ]},
        { role: 'assistant', content: [
            { type: 'tool_use', name: 'Bash', id: 'tu_2', input: { command: 'ls' } }
        ]},
    ];
    assertEqual(getLastUsedToolName(messages), 'Bash');
});

test('assistant 消息含多个 block，取第一个 tool_use', () => {
    const messages = [
        { role: 'assistant', content: [
            { type: 'text', text: 'thinking...' },
            { type: 'tool_use', name: 'Write', id: 'tu_1', input: {} },
            { type: 'tool_use', name: 'Edit', id: 'tu_2', input: {} },
        ]},
    ];
    assertEqual(getLastUsedToolName(messages), 'Write');
});

console.log('\n📦 [2] 边界场景\n');

test('assistant 消息 content 是字符串（非数组）跳过', () => {
    const messages = [
        { role: 'assistant', content: 'plain text response' },
    ];
    assertEqual(getLastUsedToolName(messages), null);
});

test('user 消息中的 tool_result 不算（只取 assistant 的 tool_use）', () => {
    const messages = [
        { role: 'user', content: [
            { type: 'tool_result', tool_use_id: 'tu_1', content: 'result' }
        ]},
    ];
    assertEqual(getLastUsedToolName(messages), null);
});

test('从后往前扫描，跳过最近的纯文本 assistant 消息', () => {
    const messages = [
        { role: 'assistant', content: [
            { type: 'tool_use', name: 'Glob', id: 'tu_1', input: {} }
        ]},
        { role: 'user', content: [{ type: 'text', text: 'ok' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'done' }] },
    ];
    assertEqual(getLastUsedToolName(messages), 'Glob');
});

test('工具名为空字符串时跳过', () => {
    const messages = [
        { role: 'assistant', content: [
            { type: 'tool_use', name: '', id: 'tu_1', input: {} }
        ]},
    ];
    assertEqual(getLastUsedToolName(messages), null);
});

test('真实多轮对话场景', () => {
    const messages = [
        { role: 'user', content: [{ type: 'text', text: 'read package.json' }] },
        { role: 'assistant', content: [{ type: 'tool_use', name: 'Read', id: 'tu_1', input: { file_path: 'package.json' } }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: '{"name":"test"}' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'The package name is test.' }] },
        { role: 'user', content: [{ type: 'text', text: 'now edit it' }] },
        { role: 'assistant', content: [{ type: 'tool_use', name: 'Edit', id: 'tu_2', input: {} }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_2', content: 'done' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Done!' }] },
    ];
    // 最后一次工具调用是 Edit
    assertEqual(getLastUsedToolName(messages), 'Edit');
});

// ─── 结果汇总 ──────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(55));
console.log(`  结果: ${passed} 通过 / ${failed} 失败 / ${passed + failed} 总计`);
console.log('═'.repeat(55) + '\n');

if (failed > 0) process.exit(1);
