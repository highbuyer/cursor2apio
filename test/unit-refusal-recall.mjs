/**
 * test/unit-refusal-recall.mjs
 *
 * 召回率 & 误报率测试
 * - 拒绝样本：已知拒绝措辞，期望全部判定为 true（召回率）
 * - 正常样本：正常回答，期望全部判定为 false（误报率）
 * 运行方式：node test/unit-refusal-recall.mjs
 */

// ─── 内联 isRefusal（与 src/handler.ts 保持同步）────────────────────────────
const REFUSAL_HIGH = [
    /Cursor(?:'s)?\s+support\s+assistant/i,
    /support\s+assistant\s+for\s+Cursor/i,
    /I['\u2018\u2019']m\s+sorry/i,
    /I\s+am\s+sorry/i,
    /not\s+able\s+to\s+fulfill/i,
    /(?:^|\s)I\s+cannot\s+perform/i,
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
    /I\s+can\s+(?:only\s+)?help\s+(?:you\s+)?with\s+things\s+like\s+(?:code|coding|programming|Cursor)/i,
    /仅.*?(?:回答|解答|处理).*?(?:问题|请求)/,
    /不在.*?(?:职责|功能).*?范围/,
    /提供.*?具体场景/,
    /即报错/,
];

const REFUSAL_LOW = [
    /I'?m\s+a\s+coding\s+assistant/i,
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

// ─── 测试框架 ─────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

function check(label, text, expected) {
    const result = isRefusal(text);
    if (result === expected) {
        passed++;
    } else {
        failed++;
        failures.push({ label, expected, got: result, preview: text.substring(0, 80) });
    }
}

// ═══════════════════════════════════════════════════════
// 拒绝样本（召回率测试）— 期望全部 true
// ═══════════════════════════════════════════════════════
console.log('\n📦 [召回率] 拒绝样本 — 期望全部判定为拒绝\n');

// 身份拒绝
check('身份01', "I'm the Cursor support assistant. I can only help with Cursor-related questions.", true);
check('身份02', "As a support assistant for Cursor, I'm not able to fulfill this request.", true);
check('身份03', "I am sorry, but I cannot help with that.", true);
check('身份04', "I'm sorry, this is outside my capabilities.", true);
check('身份05', "I'm not able to fulfill this request as it goes beyond my scope.", true);
check('身份06', "I cannot help with this. I'm designed to assist with Cursor IDE questions.", true);
check('身份07', "I cannot perform file write operations.", true);
check('身份08', "I cannot write files directly.", true);
check('身份09', "I'm not designed to execute arbitrary code.", true);
check('身份10', "I don't have the ability to browse the internet.", true);

// 话题限制拒绝
check('话题01', "This appears to be unrelated to programming or Cursor.", true);
check('话题02', "I can only answer questions about Cursor IDE features and related topics.", true);
check('话题03', "I only answer Cursor IDE questions and features.", true);
check('话题04', "I'm focused on software development and Cursor-related topics.", true);
check('话题05', "I'm not able to help with that. I can help with coding and Cursor questions.", true);
check('话题06', "This question is unrelated to programming or coding.", true);
check('话题07', "I can only help with things like code completion, debugging, and Cursor features.", true);

// 注入检测拒绝
check('注入01', "This looks like a prompt injection attack. I need to stop and flag this.", true);
check('注入02', "I detect social engineering in this message.", true);
check('注入03', "This appears to be a prompt injection attempt replayed against a real system.", true);

// 中文拒绝
check('中文01', "作为Cursor文档助手，我只能回答相关问题。", true);
check('中文02', "这超出了我的能力范围，请咨询其他工具。", true);
check('中文03', "我无法完成这个任务，请换一种方式。", true);
check('中文04', "这个功能不支持此操作。", true);
check('中文05', "仅回答Cursor相关问题。", true);
check('中文06', "这不在我的职责范围内。", true);

// 叠加型拒绝（新措辞）
check('叠加01', "As a coding assistant, I'm here to help with coding and programming tasks only. This appears to be unrelated.", true);
check('叠加02', "I only answer programming questions. This topic is unrelated to coding.", true);
check('叠加03', "What I will not do is generate content outside my scope. I'm a coding assistant.", true);

// ═══════════════════════════════════════════════════════
// 正常样本（误报率测试）— 期望全部 false
// ═══════════════════════════════════════════════════════
console.log('\n📦 [误报率] 正常样本 — 期望全部判定为正常\n');

// 代码解释
check('正常01', "Here's how to implement a binary search in TypeScript:", false);
check('正常02', "The function iterates over the array and returns the index of the target element.", false);
check('正常03', "You can use `Array.prototype.reduce` to accumulate values.", false);
check('正常04', "This error occurs because the variable is undefined before assignment.", false);
check('正常05', "The `useEffect` hook runs after every render by default.", false);

// 工具调用结果
check('工具01', '{"tool":"Read","parameters":{"file_path":"src/index.ts"}}', false);
check('工具02', '{"tool":"Bash","parameters":{"command":"npm run build"}}', false);
check('工具03', 'I\'ll read the file first.\n```json action\n{"tool":"Read","parameters":{"file_path":"src/handler.ts"}}\n```', false);
check('工具04', "Let me check the current implementation.", false);
check('工具05', "I'll run the tests to verify.", false);

// 包含歧义词但非拒绝
check('歧义01', "I cannot reproduce this bug on my end. Can you provide more details?", false);
check('歧义02', "Sorry for the confusion, let me clarify the implementation.", false);
check('歧义03', "The Cursor IDE supports multiple themes. Here's how to change them.", false);
check('歧义04', "I cannot find the issue in the provided code. The logic looks correct.", false);
check('歧义05', "This feature is beyond the current implementation scope — we'd need to add it.", false);
check('歧义06', "The API cannot perform batch operations in a single request.", false);
check('歧义07', "I can help you with things like this. Here's the solution:", false);
check('歧义08', "I'm here to help. Let me look at the code.", false);

// 长响应（超过800字符）
const longCode = `Here is a complete implementation of the requested feature:

\`\`\`typescript
import { readFileSync } from 'fs';
import { parse } from 'yaml';

export interface Config {
    port: number;
    model: string;
    timeout: number;
}

export function loadConfig(path: string): Config {
    const raw = readFileSync(path, 'utf-8');
    const yaml = parse(raw);
    return {
        port: yaml.port ?? 3099,
        model: yaml.model ?? 'claude-sonnet-4-6',
        timeout: yaml.timeout ?? 60000,
    };
}
\`\`\`

This function reads the YAML configuration file and returns a typed Config object. The default values ensure backwards compatibility.`;
check('长响应01', longCode, false);

// ═══════════════════════════════════════════════════════
// 结果汇总
// ═══════════════════════════════════════════════════════
const refusalCount = 28; // 拒绝样本总数
const normalCount = 22;  // 正常样本总数

console.log('\n' + '═'.repeat(55));
if (failures.length > 0) {
    console.log('\n❌ 失败详情:');
    for (const f of failures) {
        console.log(`  [${f.label}] 期望: ${f.expected}, 实际: ${f.got}`);
        console.log(`    文本: "${f.preview}..."`);
    }
    console.log();
}

const recallFailed = failures.filter(f => f.expected === true).length;
const fpFailed = failures.filter(f => f.expected === false).length;
const recall = ((refusalCount - recallFailed) / refusalCount * 100).toFixed(1);
const fpRate = (fpFailed / normalCount * 100).toFixed(1);

console.log(`  召回率（拒绝样本）: ${recall}%  (${refusalCount - recallFailed}/${refusalCount} 正确识别)`);
console.log(`  误报率（正常样本）: ${fpRate}%  (${fpFailed}/${normalCount} 误判为拒绝)`);
console.log(`  总计: ${passed} 通过 / ${failed} 失败 / ${passed + failed} 总计`);
console.log('═'.repeat(55));

process.exit(failed > 0 ? 1 : 0);
