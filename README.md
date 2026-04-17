<<<<<<< HEAD
# hotel-pms
=======
# 聚云酒店管理系统 - 本地运行及打包上线指南

## 📋 目录

- [一、环境准备](#一环境准备)
- [二、本地开发](#二本地开发)
- [三、Electron 桌面开发](#三electron-桌面开发)
- [四、打包上线](#四打包上线)
- [五、常见问题](#五常见问题)

---

## 一、环境准备

### 1.1 基础环境

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | ≥ 18.0.0 | 推荐 LTS 版本 |
| npm | ≥ 9.0.0 | 随 Node.js 一起安装 |

### 1.2 检查环境

```powershell
# 检查 Node.js 版本
node -v

# 检查 npm 版本
npm -v
```

### 1.3 获取代码

```powershell
# 克隆项目（如果有远程仓库）
git clone <项目地址>

# 进入项目目录
cd hotel-pms
```

---

## 二、本地开发

### 2.1 安装依赖

```powershell
# 安装根目录依赖（Electron 相关）
npm install

# 安装前端依赖
cd frontend
npm install
cd ..
```

### 2.2 启动开发服务器

**方式一：一键启动（推荐）**
```powershell
npm run dev
```
同时启动后端（端口 3001）和前端（端口 5173）

**方式二：分开启动**

终端 1 - 后端服务：
```powershell
npm run dev:server
```
> 后端运行在 http://localhost:3001

终端 2 - 前端开发服务器：
```powershell
cd frontend
npm run dev
```
> 前端运行在 http://localhost:5173

### 2.3 访问系统

打开浏览器访问：http://localhost:5173

**默认登录账号：**
- 用户名：`admin`
- 密码：`123456`

### 2.4 开发说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 3001 | 后端 API | Express + SQLite |
| 5173 | 前端开发 | Vite 热更新 |

---

## 三、Electron 桌面开发

### 3.1 启动 Electron 开发模式

```powershell
npm run electron:dev
```
> 会自动等待后端和前端启动完成后，再启动 Electron 窗口

### 3.2 访问地址

在 Electron 窗口中会自动打开：http://localhost:5173

---

## 四、打包上线

### 4.1 前置准备

1. 确保已完成所有开发
2. 检查 `electron/icon.ico` 图标文件是否存在（可选）
3. 清理不需要的文件

### 4.2 执行打包

```powershell
npm run electron:build
```

### 4.3 打包流程

打包过程会自动执行以下步骤：

```
1. 前端构建 → 生成 dist/ 静态文件
2. 复制服务端依赖 → _server_deps/
3. 复制 Node 运行时 → _node_runtime/node.exe
4. Electron 打包 → 生成 .exe 安装包
```

### 4.4 输出位置

打包成功后，`.exe` 安装包位于：

```
hotel-pms/dist/
```

### 4.5 安装包说明

| 文件类型 | 说明 |
|---------|------|
| `.exe` | NSIS 安装向导（推荐） |
| `unpacked/` | 便携版（无需安装） |

---

## 五、常见问题

### Q1: 端口被占用

```powershell
# 查找占用端口的进程
netstat -ano | findstr :3001
netstat -ano | findstr :5173

# 结束进程（替换 <PID> 为实际进程ID）
taskkill /PID <PID> /F
```

### Q2: 依赖安装失败

```powershell
# 清理缓存
npm cache clean --force

# 删除 node_modules 后重装
rm -rf node_modules package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
npm install
```

### Q3: 打包失败 - 缺少 node.exe

确保 `_node_runtime/node.exe` 文件存在，或运行：
```powershell
node scripts/copy-node-runtime.js
```

### Q4: SQLite 数据库文件位置

数据库文件位于：`server/data/hotel.db`

首次运行会自动创建并初始化表结构。

### Q5: 前端 API 代理配置

开发环境下 Vite 代理配置在 `frontend/vite.config.js`：
- `/api/*` → `http://localhost:3001`
- `/auth/*` → `http://localhost:3001`

---

## 📞 技术支持

如遇问题，请提供以下信息：
1. 操作系统版本
2. Node.js 版本
3. 错误完整信息（截图或文字）
4. 操作步骤描述
>>>>>>> 0595c46 (feat: 聚云酒店管理系统 v1.0)
