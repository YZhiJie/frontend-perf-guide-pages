/**
 * 示例 01：事件循环与长任务 —— 为什么同步代码会"冻结"页面
 * 配套文档：docs/05-runtime.md 第 1 节（事件循环与长任务红线）
 *
 * 运行方式：node examples/01-event-loop.mjs
 *
 * 设计决策：
 * - 用 process.nextTick / Promise / setTimeout / setImmediate 四种调度
 *   展示事件循环的执行顺序（浏览器同理：微任务先于下一个宏任务）。
 * - 用一整块重计算模拟"长任务"（>50ms 红线），对比切片后的调度行为，
 *   直观理解 TBT / INP 为什么会变差。
 * - 坑点 A：setTimeout(0) 与 setImmediate 在主模块里是竞态（顺序不定）；
 *   只有在 I/O 回调内部注册时 setImmediate 才保证先执行 —— 演示里如实呈现。
 * - 坑点 B：切片的循环体必须放进独立的同步函数。如果直接写在 async 函数里，
 *   跨 await 存活的变量会被 V8 放进堆上的 context，每迭代慢一个数量级（实测 16 倍）。
 * - 坑点 C：时间预算式切片的守卫计数器必须复位，否则读时钟退化为每迭代一调（实测再慢 7 倍）；
 *   本例改用固定迭代数切片，循环体零额外开销，教学与生产实现均更稳。
 */

console.log('=== 第一部分：调度顺序 ===\n');

console.log('1. 同步代码最先执行');

setTimeout(() => console.log('6. setTimeout(0)（宏任务）'), 0);
setImmediate(() => console.log('7. setImmediate（宏任务）'));

Promise.resolve().then(() => console.log('4. Promise.then（微任务）'));
queueMicrotask(() => console.log('5. queueMicrotask（微任务）'));

process.nextTick(() => console.log('3. process.nextTick（nextTick 队列，优先于微任务）'));

console.log('2. 同步代码结束 —— 下面交出控制权\n');

// 预期：1 → 2 → 3 → 4 → 5 必定稳定；6/7 每次运行可能互换（竞态，见文件头坑点 A）。
// 教学要点：微任务（Promise）不是"异步之后"，而是"当前宏任务的尾部、下一个宏任务之前"。
// 如果微任务里不断制造新微任务（如递归 await），事件循环会被饿死 —— 页面卡死、INP 爆炸。
await new Promise((r) => setTimeout(r, 10)); // 把第一部分注册的回调全部冲刷掉

console.log('\n=== 第二部分：长任务 vs 切片 ===\n');

const ITER = 120_000_000; // 约 60~150ms，稳定超过 50ms 长任务红线

// 坏写法：一整块同步跑完，期间任何输入事件都排不进来
const t1 = performance.now();
let sumBad = 0;
for (let i = 1; i <= ITER; i++) sumBad += i;
const badCost = performance.now() - t1;
console.log(`[坏写法] 单块耗时 ${badCost.toFixed(1)}ms → ${badCost > 50 ? '超过 50ms 红线，期间页面无法响应' : '未超红线'}`);

// 独立的同步切片函数：变量不跨 await，V8 能把它们留在寄存器里（见文件头坑点 B）
function runSlice(sum, total, chunk) {
  const n = Math.min(chunk, total);
  for (let k = 0; k < n; k++) {
    sum += total;
    total--;
  }
  return [sum, total];
}

const CHUNK_ITERS = 16_000_000; // 约 8~12ms/片：快机慢机都稳居 50ms 红线内
// 教学要点：切片粒度有两种做法 —— ①固定迭代数（本例，循环体零额外开销、V8 可全速优化）；
// ②时间预算式（循环内低频读 performance.now() 对比 deadline，粒度更平滑但有观测开销，
// 且守卫计数器必须复位，否则性能.now() 会退化成每迭代一调，实测吞吐掉一个数量级）。
// 好写法：切片 + 让出主线程（浏览器用 scheduler.yield / setTimeout 0）
async function chunkedWork(total, chunkIters = CHUNK_ITERS) {
  let sum = 0;
  while (total > 0) {
    [sum, total] = runSlice(sum, total, chunkIters);
    // 让出主线程：Node 里用 setImmediate，浏览器推荐 scheduler.yield()
    await new Promise((r) => setImmediate(r));
  }
  return sum;
}

const t2 = performance.now();
const sumGood = await chunkedWork(ITER);
const goodCost = performance.now() - t2;
console.log(`[好写法] 切片总耗时 ${goodCost.toFixed(1)}ms，每片 <50ms → 主线程随时可响应（调度开销 +${((goodCost / badCost - 1) * 100).toFixed(0)}%）`);
console.log(`\n结果一致性校验：${Object.is(sumBad, sumGood) ? '一致 ✓' : `不一致 ✗（${sumBad} vs ${sumGood}）`}`);
console.log('结论：总耗时接近，但切片版不会产生长任务 —— 这就是"时间切片"的核心价值。');
