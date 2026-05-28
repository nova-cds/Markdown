# Markdown 编辑器组件

基于 [Vditor](https://github.com/Vanessa219/vditor) 的 Typora 风格 Markdown 编辑器。

## 组件结构

### 1. VditorEditor.tsx - 主编辑器组件
- 封装 Vditor 的 React 组件
- 使用 useRef 管理编辑器实例
- 使用 useEffect 初始化 Vditor
- 支持传入 path 参数标识当前文档
- 内容变化时调用 updateDocument 更新 store
- 处理图片粘贴事件（Ctrl+V 粘贴图片保存到本地 img 目录）
- 支持三种编辑模式：所见即所得（wysiwyg）、实时渲染（ir）、分屏预览（sv）

### 2. EditorContainer.tsx - 编辑器容器
- 从 useEditorStore 获取 activeDocPath
- 没有文档时显示欢迎界面
- 有文档时渲染 VditorEditor 组件

### 3. PaneContainer.tsx - 分栏窗格容器
- 管理分栏布局中的窗格
- 支持水平/垂直分栏
- 处理窗格间的拖拽操作

### 4. ReplaceDialog.tsx - 查找替换对话框
- 支持文档内容查找和替换
- 支持大小写敏感/正则匹配

### 5. EmojiPicker.tsx - Emoji 选择器
- 支持系统 Emoji 表情分组浏览和选择

### 6. ContextMenu.tsx - 右键菜单
- 编辑器内右键操作菜单

### 7. CloseTabConfirm.tsx - 关闭确认
- 关闭未保存文档时的确认对话框

### 8. PaneWelcome.tsx - 窗格欢迎页
- 空窗格的欢迎/引导界面

## 使用方法

```tsx
import { EditorContainer } from './components/Editor'

function App() {
  return (
    <div className="app">
      <EditorContainer />
    </div>
  )
}
```

## 快捷键

- `Ctrl+B`: 加粗
- `Ctrl+I`: 斜体
- `Ctrl+D`: 删除线
- `Ctrl+S`: 保存
- `Ctrl+Shift+S`: 另存为
- `Ctrl+M`: 插入表格
- `Ctrl+=`: 表格插入行
- `Ctrl+-`: 表格删除当前行
- `Ctrl+Shift+=`: 表格插入列
- `Ctrl+Shift+-`: 表格删除当前列
- `Ctrl+/`: 切换实时渲染与预览模式

## 特性

1. **Typora 风格编辑体验**
   - 所见即所得
   - 实时渲染（类似 Typora）
   - 分屏预览

2. **图片支持**
   - Ctrl+V 粘贴图片，自动保存到 img 目录
   - 使用相对路径引用图片（可配置目录名）

3. **Markdown 语法支持**
   - 标题 (h1-h6)
   - 段落
   - 列表（有序/无序/任务列表）
   - 引用
   - 代码块
   - 链接、图片
   - 粗体/斜体/删除线
   - 行内代码
   - 表格
   - 脚注
   - 高亮（==标记==）
   - 上标、下标
   - TOC 目录
   - Mermaid 图表
   - PlantUML 图表
   - Emoji 表情
   - 文档嵌入（`[[显示信息]](xxx.md)`）

4. **状态管理**
   - 文档状态持久化
   - 编辑器状态保存
   - 多文档标签页支持

## 依赖

- react
- vditor（Markdown 编辑器引擎）
- zustand（状态管理）
- lucide-react（图标）

## 样式

编辑器样式在 `vditor-styles.css` 中定义，包含：
- 编辑器容器样式
- Vditor 主题覆盖（亮色/暗色）
- 有序列表缩进层级样式
- 响应式布局

## 注意事项

1. 编辑器使用 Vditor 作为核心引擎
2. Markdown 解析和渲染由 Vditor 内部处理
3. 状态管理使用 zustand
4. 所有组件都使用 TypeScript 编写，确保类型安全
5. Vditor 静态资源存放在 `public/vditor/` 目录下
