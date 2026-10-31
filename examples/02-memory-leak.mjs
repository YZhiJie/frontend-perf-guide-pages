/**
 * 示例 02：四类常见内存泄漏 —— 用 --expose-gc 实测堆增长
 * 配套文档：docs/05-runtime.md 第 4 节（内存泄漏四大模式）
 *
 * 运行方式：node --expose-gc examples/02-memory-leak.mjs
 *
 * 设计决策：
 * - 每种泄漏模式跑 N 轮 + 手动 gc() + process.memoryUsage() 采样，
 *   让堆增长"看得见"。
 * - 最后给出对应的修复写法对照。
 * - 坑点：没有 --expose-gc 时 globalThis.gc 是 undefined，脚本会直接
 *   提示退出，避免给出误导性的测量结果。
 */

if (typeof globalThis.gc !== 'function') {
  console.error('请使用：node --expose-gc examples/02-memory-leak.mjs');
  process.exit(1);
}

const heapMB = () => (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

/** 模式 1：全局数组无限累积（最常见：日志、埋点、缓存没有上限） */
function leak1() {
  const bag = []; // 本应挂在全局/长生命周期对象上
  for (let round = 0; round < 50; round++) {
    bag.push(new Array(10_000).fill(round)); // 只进不出
    globalThis.gc();
  }
  console.log(`  全局累积 50 轮后堆：${heapMB()} MB（初始 ${initial} MB）`);
}

/** 模式 2：闭包意外持有大对象 */
function leak2() {
  let leaked = [];
  function attach() {
    const big = new Array(50_000).fill('closure'); // 被 attach 闭包捕获
    return () => big.length; // 只要这个函数活着，big 就无法回收
  }
  const keep = [];
  for (let i = 0; i < 50; i++) keep.push(attach());
  globalThis.gc();
  console.log(`  闭包持有 50 个大数组后堆：${heapMB()} MB（初始 ${initial} MB）`);
}

/** 模式 3：定时器/回调注册后从不清理 */
function leak3() {
  const timers = [];
  for (let i = 0; i < 200; i++) {
    const big = new Array(5_000).fill('timer'); // 定时器回调的闭包捕获的数据
    // 现实对应：组件卸载/节点移除时忘了 clearInterval / removeEventListener。
    // 坑点：泄漏的不只是回调本身，还有它闭包捕获的一切 —— 常见的是整棵组件树/大状态。
    timers.push(setInterval(() => big.length, 1 << 30)); // 不会触发，但闭包一直被钉住
  }
  globalThis.gc();
  console.log(`  注册 200 个带闭包的定时器后堆：${heapMB()} MB（初始 ${initial} MB）`);
  timers.forEach(clearInterval); // 演示完清理，防止脚本自身内存膨胀
}

/** 模式 4：Map 以对象为键形成强引用（对应浏览器里的 detached DOM） */
function leak4() {
  const store = new Map();
  for (let i = 0; i < 100; i++) {
    const node = { id: i, html: new Array(20_000).fill('<div>x</div>') }; // 模拟带大子树的 DOM 节点
    store.set(node, { meta: i }); // node 已"从树上摘下"，但 Map 强引用让它无法回收
  }
  globalThis.gc();
  console.log(`  Map 强持有 100 个"游离节点"后堆：${heapMB()} MB（初始 ${initial} MB）`);
  console.log('  修复：改用 WeakMap —— 键为弱引用，节点被 GC 即自动清理。');
}

const initial = heapMB();
console.log(`初始堆：${initial} MB\n`);
leak1();
leak2();
leak3();
leak4();
globalThis.gc();
console.log(`\n结束后统一 gc() 回收：${heapMB()} MB —— 唯一真正回收不掉的只有 WeakMap 之外仍被强引用的部分。`);
console.log('浏览器里对应 DevTools Performance 面板的"内存锯齿"与 Memory 面板的堆快照对比。');
