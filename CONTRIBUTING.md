# 贡献指南

感谢你对 MD Editor 项目的关注！欢迎提交 Issue 和 Pull Request。

## 开发环境

### 前置要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/)（仅桌面应用开发需要）

### 安装和运行

```bash
# 克隆仓库
git clone https://github.com/jiewanle123-bot/Markdown.git
cd Markdown

# 安装依赖
npm install

# 启动开发服务器（Web 版本）
npm run dev

# 构建
npm run build
```

### 代码检查

```bash
# ESLint 检查
npm run lint

# ESLint 自动修复
npm run lint:fix

# Prettier 格式化
npm run format

# Prettier 格式检查
npm run format:check
```

## 项目结构

```
src/
├── components/       # React 组件
│   ├── Editor/       # 编辑器核心（基于 Vditor）
│   ├── Layout/       # 布局
│   ├── Sidebar/      # 文件目录树
│   ├── Tabs/         # 标签页
│   ├── TitleBar/     # 标题栏
│   ├── Toolbar/      # 工具栏
│   ├── Settings/     # 设置面板
│   └── Update/       # 更新通知
├── hooks/            # 自定义 React Hooks
├── stores/           # Zustand 状态管理
├── styles/           # 全局样式
└── utils/            # 工具函数
```

## 提交规范

请使用以下前缀格式提交 commit：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 样式调整（不影响逻辑）
- `refactor:` 代码重构
- `perf:` 性能优化
- `chore:` 构建/工具链相关
- `ci:` CI/CD 相关

示例：
```
feat: 添加表格快捷键支持
fix: 修复暗色模式下代码块样式
docs: 更新 README 快捷键说明
```

## Pull Request

1. Fork 本仓库
2. 创建你的功能分支：`git checkout -b feat/my-feature`
3. 提交你的修改：`git commit -m 'feat: 添加某功能'`
4. 推送到分支：`git push origin feat/my-feature`
5. 提交 Pull Request

### PR 要求

- 确保 `npm run build` 构建通过
- 确保 `npm run lint` 无错误
- 简要描述改动内容和原因

## 报告问题

提交 Issue 时请包含：

- 问题描述
- 复现步骤
- 期望行为
- 实际行为
- 运行环境（操作系统、浏览器/桌面版本）
- 截图（如有）

## License

本项目采用 [MIT](LICENSE) 协议。
