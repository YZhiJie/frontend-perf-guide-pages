# EP.07 · 《React 后厨的调度艺术》

> 🎬 漫画：[EP.07.svg](./EP.07.svg) ｜ 📄 对应文档：[第 7 章 · React 专项优化方案](../docs/07-react.md)
>
> 本话主旨：React 的性能之道——先修结构（状态下放/组合），再上记忆化（memo 三件套），用并发特性保交互。

## 本话剧情

小奔到 React 餐馆后厨，发现规矩奇特：老板娘（状态）一喊单，全厨房连不相干的灶台都重做一遍（重渲染递归传播）。稳叔教调度艺术：给盘子贴「React.memo 没变别重做」标签（配合 useMemo/useCallback 才有效）、配菜的状态归配菜台管（状态下放）、大菜单拆成小房间（lazy + Suspense）、不紧急的切菜让给急单（useTransition）。最后踩坑：列表 key 用数组下标，删一道菜全桌上错菜。

## 知识点节点

### 节点 1 · 一喊全动：重渲染的传播（漫画第 1 格）

- **生活映射**：老板娘一喊单全厨房动 = 父组件重渲染时默认递归重渲染全部子树，props 没变也重跑。
- **技术对应**：三个触发源（state/父组件/context）；先跑 Profiler 找热点再动手。
- **深入阅读**：📖 [1. 重渲染的触发链条](../docs/07-react.md#1-重渲染的触发链条)

### 节点 2 · 贴标签：memo 三件套的组合拳（漫画第 2 格）

- **生活映射**：盘子贴「没变别重做」（memo）+ 备好半成品（useMemo）+ 备好餐具（useCallback）——三样缺一不可。
- **技术对应**：memo 浅比较 props；函数 props 不稳定则 memo 失效；先测量再缓存，禁止全站包裹。
- **深入阅读**：📖 [2. 渲染控制三件套：memo useMemo 与 useCallback](../docs/07-react.md#2-渲染控制三件套memo-usememo-与-usecallback)

### 节点 3 · 状态下沉与插队：结构优化与并发（漫画第 3 格）

- **生活映射**：配菜的状态归配菜台（状态下放）；不紧急的切菜让给急单（useTransition 低优先级更新）。
- **技术对应**：状态放最小公共父级、children 组合穿透、Context 按频率拆分；useDeferredValue 保输入跟手。
- **深入阅读**：📖 [3. 状态下放与组件组合](../docs/07-react.md#3-状态下放与组件组合)、[6. 并发特性：useTransition 与 useDeferredValue](../docs/07-react.md#6-并发特性usetransition-与-usedeferredvalue)

### 节点 4 · 最大坑点：下标 key 上错菜（漫画第 4 格）

- **误区**：列表 key 用数组下标——删除中间项后所有 key 前移，React 全列表重渲染，带输入状态的行还会状态错位。
- **正解**：key 用稳定唯一业务 id；React 19 可启用 Compiler 自动记忆化，但结构优化仍是根本。
- **深入阅读**：📖 [4. 列表渲染与 key 的正确用法](../docs/07-react.md#4-列表渲染与-key-的正确用法)、[8. React 19：Compiler 与自动记忆化](../docs/07-react.md#8-react-19compiler-与自动记忆化)

## 常见认知误区

| 误区 | 真相 |
| --- | --- |
| 用了 memo 性能就好 | 函数 props 每次新引用时 memo 形同虚设，必须配 useCallback/useMemo |
| useMemo/useCallback 越多越好 | 比较与缓存本身有成本，热点组件才值得 |
| React 19 Compiler 能自动救一切 | 它替代的是手动记忆化，替代不了状态下放/订阅粒度等结构优化 |

## 自测三题

**1. React.memo 失效的常见原因是？**

A. props 是每次新建的函数或对象　B. 组件没有 state　C. 使用了 JSX

> 答案：A。浅比较失败；需配合 useCallback / useMemo 稳定引用。

**2. 让紧急输入优先、列表更新降级，应该用？**

A. useMemo　B. useTransition　C. useEffect

> 答案：B。useTransition 把非紧急更新标记为可中断的低优先级。

**3. 列表 key 使用数组下标会有什么后果？**

A. 渲染更快　B. 删除中间项后状态错位并触发多余重渲染　C. 完全无影响

> 答案：B。key 前移导致 React 复用错误的节点实例。

## 一句话带走

**结构对了才谈优化：状态下放缩小范围、三件套精准缓存、并发特性保交互——React 优化的本质是控制「谁该重渲染」。**

---

> 📚 下一话预告：[EP.08《性能体检中心》](./EP.08.md)——性能工具完全指南 ｜ 跳转：[第 8 章 · 性能检测工具完全指南](../docs/08-tools.md)
