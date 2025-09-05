# 项目结构优化建议

## 当前结构分析

### 优点
- 使用 Vue 3 + TypeScript + Vite 的现代技术栈
- 组件化设计，职责分离清晰
- 使用 Vuex 进行状态管理
- 工具函数和类型定义分离

### 需要改进的地方

## 建议的新结构

```
src/
├── components/           # 通用组件
│   ├── common/          # 基础通用组件
│   │   ├── Button/
│   │   ├── Modal/
│   │   └── Loading/
│   ├── game/            # 游戏相关组件
│   │   ├── BoardComponent/
│   │   ├── ChessPiece/
│   │   ├── GameControls/
│   │   └── ScoreDisplay/
│   ├── layout/          # 布局组件
│   │   ├── NavbarComponent/
│   │   ├── Sidebar/
│   │   └── Footer/
│   └── quantum/         # 量子围棋特有组件
│       ├── QuantumPhaseIndicator/
│       └── QuantumBoard/
├── composables/         # 组合式函数
│   ├── useGame.ts
│   ├── useWebSocket.ts
│   └── useChess.ts
├── constants/           # 常量定义
│   ├── game.ts
│   ├── api.ts
│   └── ui.ts
├── hooks/              # 自定义钩子
│   ├── useAuth.ts
│   └── useGameState.ts
├── services/           # 服务层
│   ├── api/
│   │   ├── game.ts
│   │   ├── user.ts
│   │   └── index.ts
│   ├── websocket/
│   │   └── gameSocket.ts
│   └── storage/
│       └── localStorage.ts
├── stores/             # 状态管理（重命名）
│   ├── modules/
│   └── index.ts
├── types/              # 类型定义（重命名）
│   ├── game.ts
│   ├── api.ts
│   └── index.ts
├── utils/              # 工具函数
│   ├── chess/          # 围棋相关工具
│   │   ├── rules.ts
│   │   ├── calculation.ts
│   │   └── validation.ts
│   ├── common/         # 通用工具
│   │   ├── format.ts
│   │   ├── validation.ts
│   │   └── helpers.ts
│   └── constants.ts
├── views/              # 页面组件
│   ├── auth/
│   │   ├── LoginPage/
│   │   └── RegisterPage/
│   ├── game/
│   │   ├── GamePage/
│   │   ├── RoomPage/
│   │   └── AIPage/
│   ├── leaderboard/
│   │   └── LeaderboardPage/
│   └── home/
│       └── IndexPage/
├── assets/             # 静态资源
│   ├── images/
│   ├── icons/
│   └── styles/
│       ├── variables.scss
│       ├── mixins.scss
│       └── global.scss
└── router/             # 路由配置
    └── index.ts
```

## 具体改进建议

### 1. 组件分类重组
- 将组件按功能分类到不同目录
- 创建通用组件库
- 分离游戏逻辑和UI组件

### 2. 工具函数模块化
- 将 chess.ts 拆分为多个专门的文件
- 创建通用工具函数库
- 按功能分类组织

### 3. 类型定义优化
- 将 types.ts 拆分为多个文件
- 按模块组织类型定义
- 添加更详细的类型注释

### 4. 服务层抽象
- 创建 API 服务层
- 抽象 WebSocket 连接
- 统一错误处理

### 5. 组合式函数
- 提取可复用的逻辑到 composables
- 创建自定义钩子
- 提高代码复用性

## 实施步骤

1. **第一阶段**：重组现有文件结构
2. **第二阶段**：拆分大型文件
3. **第三阶段**：创建新的抽象层
4. **第四阶段**：优化导入路径
5. **第五阶段**：添加测试和文档
