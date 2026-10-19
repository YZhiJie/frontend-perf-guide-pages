// 性能小镇 · 漫画清单
// 走 <script src> 加载而非 fetch JSON，保证阅读器在 file:// 协议下直接可用（无跨域限制）
// 字段：id=话数；svg=漫画文件；notes=讲解稿；doc=对应标准文档；docTitle=文档章节名
window.COMIC_MANIFEST = {
  series: '性能小镇 · 前端性能优化漫画教程',
  episodes: [
    {
      id: 'EP.01', title: '小镇的早高峰', svg: 'EP.01.svg', notes: 'EP.01.html',
      doc: '../docs/01-overview.html', docTitle: '第 1 章 · 性能优化总览与心智模型',
      summary: '早高峰大堵车讲用户流失，指挥中心账本讲性能度量，修路三步法讲优化闭环。',
    },
    {
      id: 'EP.02', title: '快递签收的三门课', svg: 'EP.02.svg', notes: 'EP.02.html',
      doc: '../docs/02-core-web-vitals.html', docTitle: '第 2 章 · Core Web Vitals 核心指标详解',
      summary: '快递站讲透三大指标：最大包裹何时到（LCP）、门铃响了谁开门（INP）、家具自己搬家（CLS）。',
    },
    {
      id: 'EP.03', title: '餐厅备菜大作战', svg: 'EP.03.svg', notes: 'EP.03.html',
      doc: '../docs/03-loading.html', docTitle: '第 3 章 · 加载性能优化：网络与资源',
      summary: 'CDN 就近备菜、压缩缓存预制半成品、菜单拆页与按需做菜，上菜 40 分钟变 8 分钟。',
    },
    {
      id: 'EP.04', title: '装修队的血泪史', svg: 'EP.04.svg', notes: 'EP.04.html',
      doc: '../docs/04-rendering.html', docTitle: '第 4 章 · 渲染性能优化：让每一帧都丝滑',
      summary: '量一次改一次的返工地狱（布局抖动），到批量读写、换窗帘不搬家（合成层）的装修智慧。',
    },
    {
      id: 'EP.05', title: '仓库整理惊魂', svg: 'EP.05.svg', notes: 'EP.05.html',
      doc: '../docs/05-runtime.html', docTitle: '第 5 章 · 运行时性能：主线程、内存与泄漏',
      summary: '超大件卡住所有订单（长任务），作废订单挂满墙（内存泄漏），拆小份加及时清理。',
    },
    {
      id: 'EP.06', title: 'Vue 后厨的智慧', svg: 'EP.06.svg', notes: 'EP.06.html',
      doc: '../docs/06-vue.html', docTitle: '第 6 章 · Vue 专项优化方案',
      summary: '加碗饭别重做整桌菜（组件级更新），computed 半成品、KeepAlive 常客座位与 v-memo 旧盘直端。',
    },
    {
      id: 'EP.07', title: 'React 后厨的调度艺术', svg: 'EP.07.svg', notes: 'EP.07.html',
      doc: '../docs/07-react.html', docTitle: '第 7 章 · React 专项优化方案',
      summary: '老板娘一喊全厨房动（重渲染传播），memo 贴标签、状态下放、useTransition 让急单插队。',
    },
    {
      id: 'EP.08', title: '性能体检中心', svg: 'EP.08.svg', notes: 'EP.08.html',
      doc: '../docs/08-tools.html', docTitle: '第 8 章 · 性能检测工具完全指南',
      summary: 'Lighthouse 医生打分开单，Performance CT 机找堵点，WebPageTest 异地会诊加 web-vitals 手环。',
    },
    {
      id: 'EP.09', title: '工厂质检上线记', svg: 'EP.09.svg', notes: 'EP.09.html',
      doc: '../docs/09-production.html', docTitle: '第 9 章 · 生产环境落地实践',
      summary: '先立性能预算合格线，CI 质检流水线自动过磅体检，RUM 黑匣子数据回流自动报警。',
    },
  ],
};
