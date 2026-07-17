# 旅途 · Fluid Travel — 项目身份与 GitHub / 换机说明

> **重要：本仓库只属于「旅途 / travel-planner」这一个项目。**  
> 请勿与同机其它目录（如 API 网关、注册工具、其它 Web 项目）混用路径、混用远程仓库或混用推送脚本。

---

## 1. 项目身份证（先认准这些再动手）

| 项 | 值 | 说明 |
|----|-----|------|
| **中文名** | 旅途 · Fluid Travel | 界面品牌名 |
| **本地根目录** | `C:\project\travel-planner` | **仅此路径** |
| **GitHub 用户名** | `1510952971` | 当前已登录并推送的账号 |
| **GitHub 仓库名（固定）** | `travel-planner` | 不要改成别的项目名 |
| **远程地址（已创建）** | `https://github.com/1510952971/travel-planner` | **仅此仓库**，勿与其它项目混淆 |
| **入口文件** | `index.html` | 纯前端，无后端服务依赖 |
| **启动脚本** | `start.bat` | 本目录内静态服务 |
| **默认本地地址** | `http://127.0.0.1:8765` | 以 `start.bat` 实际端口为准 |
| **浏览器数据键** | `travel_planner_v1` 等 | 存在本机浏览器，**不会进 Git** |

### 目录里应能看到（抽查是否下错仓库）

```
travel-planner/
  index.html
  start.bat
  push-to-github.bat    ← 仅上传本项目
  css/styles.css
  js/app.js
  js/map.js
  js/city-catalog.js
  js/generator.js
  docs/
  README.md
```

若目录是 `grokcli`、`register`、`docker` 等其它名字，**说明不是本项目**。

---

## 2. 绝对不要和别的项目弄混

### 2.1 路径隔离

| 正确 | 错误 |
|------|------|
| 只在 `C:\project\travel-planner` 里改代码、提交、推送 | 在 `C:\project` 根目录或其它子项目里执行 `git push` |
| 克隆到 `...\travel-planner` 专用文件夹 | 克隆进已经有别的 Git 仓库的文件夹 |
| 本仓库 remote 名为 `travel-planner` | remote 指向别的 repo（API / 注册工具等） |

### 2.2 本机 `C:\project` 下常见其它目录（勿混）

以下若存在，**与本项目无关**，不要互相拷脚本、不要共用一个 Git 远程：

- 各类 `*-api`、网关、代理
- 注册 / 登录辅助工具
- 其它前端或桌面应用

**规则：一个文件夹 = 一个 Git 仓库 = 一个 GitHub 项目名。**

### 2.3 浏览器数据不会跟着 Git 走

- 行程、预算、装备等保存在 **当前浏览器的 localStorage**。
- 换电脑 `git clone` **不会**带上旧行程；需要的话在旧电脑用应用内 **导出 JSON**，新电脑再 **导入**。
- 不要把整份浏览器用户数据目录提交进仓库。

### 2.4 不要提交的内容

见根目录 `.gitignore`（环境密钥、`node_modules`、编辑器缓存等）。  
本项目当前为纯静态前端，一般 **无 API Key 可提交**。

---

## 3. 首次上传到 GitHub（本机已有源码时）

### 前提

- 已安装 [Git](https://git-scm.com/)
- 已安装 GitHub CLI：`winget install --id GitHub.cli -e`
- 有 GitHub 账号

### 推荐：只用本项目脚本

1. 资源管理器进入：**`C:\project\travel-planner`**
2. 双击 **`push-to-github.bat`**
3. 浏览器完成 GitHub 登录授权
4. 脚本会创建（或更新）仓库 **`travel-planner`** 并推送
5. 成功后打开：`https://github.com/<你的用户名>/travel-planner`

脚本开头会打印仓库名 `travel-planner`，请确认不是别的名字再继续。

### 手动命令（可选，必须先 cd 到本目录）

```bat
cd /d C:\project\travel-planner
gh auth login
gh repo create travel-planner --public --source=. --remote=origin --push
```

若仓库已存在：

```bat
cd /d C:\project\travel-planner
git remote add origin https://github.com/<你的用户名>/travel-planner.git
git push -u origin main
```

---

## 4. 换电脑：下载与编辑

### 4.1 克隆（认准仓库名）

```bash
# 建议放到独立目录，例如：
cd D:\work
git clone https://github.com/1510952971/travel-planner.git
cd travel-planner
```

**检查：**

```bash
# 应显示 travel-planner 远程
git remote -v
# 应能看到 index.html、start.bat、js/app.js
dir
```

### 4.2 运行

- Windows：双击 **`start.bat`**
- 浏览器打开提示的本地地址（常见 `http://127.0.0.1:8765`）
- 样式/脚本异常时：**Ctrl + F5** 强制刷新（Service Worker 可能缓存旧壳）

### 4.3 日常改代码再同步

```bash
cd travel-planner
git pull
# ... 编辑 ...
git add -A
git status          # 确认只在本仓库内
git commit -m "说明本次修改"
git push
```

或在本机目录再运行一次 **`push-to-github.bat`**（会提交未提交改动并推送）。

---

## 5. 功能概览（便于确认是「旅途」而不是别的 App）

- 多城站序：省·市·县，可重复途经、环线/线性  
- 大屏工作台：侧栏可收起、参数配置 + 概览/日程  
- 日程画布 + **地图选点**（钉点可拖）  
- 预算 / 分账 / 行李 / 光影 / 装备 / 镜头 / 搭子  
- 导出：JSON、Markdown、分享页、摄影志  
- 数据：浏览器本地；无商业地图 Key  

更细的产品与边界见：

- `docs/需求实现对照表.md`
- `docs/产品方案与路线图.md`

---

## 6. 自检清单（上传前 / 克隆后）

- [ ] 当前目录是 `...\travel-planner`，不是其它项目  
- [ ] `git remote -v` 含有 `travel-planner`  
- [ ] 存在 `index.html`、`js/app.js`、`js/city-catalog.js`  
- [ ] 没有把 `.env`、密钥、别的项目源码拷进本目录  
- [ ] 换机后行程用 **导出/导入 JSON**，不依赖 Git  

---

## 7. 故障简述

| 现象 | 处理 |
|------|------|
| `gh` 不是内部或外部命令 | 新开终端；或 `winget install --id GitHub.cli -e` |
| 未登录 GitHub | `gh auth login` 或再跑 `push-to-github.bat` |
| 推到错误仓库 | `git remote -v` 检查；错误则 `git remote set-url origin https://github.com/<用户>/travel-planner.git` |
| 页面像旧版 | Ctrl+F5；或浏览器清除本站 Service Worker / 缓存 |
| 侧栏/地图布局怪 | 确认打开的是本项目的 `index.html`（端口与路径） |

---

**文档版本：** 与仓库源码一并维护。  
**范围：** 仅 `travel-planner` / 旅途 Fluid Travel。
