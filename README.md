# 旅途 · Fluid Travel

> **项目代号 / 仓库名：`travel-planner`**  
> **本机路径：`C:\project\travel-planner`**  
> 纯前端旅行规划器。请勿与同目录下其它项目混用仓库或推送脚本。

多城环线 · 日程画布 · 地图选点 · 预算/行李/光影等。行程数据默认存在浏览器 `localStorage`（**不会**随 Git 同步）。

---

## 项目边界（避免弄混）

| 项目 | 路径 / 仓库 | 说明 |
|------|-------------|------|
| **本项目** | `C:\project\travel-planner` → GitHub **`travel-planner`** | 仅此 |
| 其它 | `C:\project\` 下任意其它文件夹 | **无关**，勿共用 git remote |

上传、克隆、改代码时请先确认：

1. 终端当前目录是 `travel-planner`  
2. 存在 `index.html`、`start.bat`、`js/app.js`  
3. `git remote -v` 指向 `.../travel-planner.git`  

更完整的说明见：**[docs/项目身份与GitHub换机说明.md](docs/项目身份与GitHub换机说明.md)**

---

## 从 GitHub 换电脑使用

```bash
git clone https://github.com/1510952971/travel-planner.git
cd travel-planner
```

1. 双击 **`start.bat`**（Windows）  
2. 浏览器打开 **http://127.0.0.1:8765**（以脚本为准）  
3. 异常时 **Ctrl + F5** 强刷  

旧电脑行程请在应用内 **导出 JSON**，新电脑 **导入**（Git 不包含浏览器本地数据）。

---

## 本机上传到 GitHub

1. 进入 **`C:\project\travel-planner`**（不要在别的项目目录操作）  
2. 双击 **`push-to-github.bat`**  
3. 浏览器完成 GitHub 登录  
4. 成功后访问：`https://github.com/1510952971/travel-planner`  

脚本固定仓库名为 **`travel-planner`**，避免误建/误推其它项目。

---

## 功能摘要

| 模块 | 说明 |
|------|------|
| 站序 | 省·市·县，可重复途经，线性/环线 |
| 日程 | 画布拖拽、跨天、重抽模板 |
| 地图 | OSM 折线、**选点钉坐标**、可拖微调 |
| 预算 | 多币种、图表、AA 分账 |
| 其它 | 天气行李、光影、装备、镜头、搭子、导出 MD/分享页/摄影志 |
| 布局 | 大屏工作台，侧栏可收起 |

摄影相关能力已并入普通模式（顶栏 Tab 常驻），无需单独开关。

---

## 文档索引

| 文件 | 内容 |
|------|------|
| [docs/项目身份与GitHub换机说明.md](docs/项目身份与GitHub换机说明.md) | **身份隔离、上传/克隆、自检** |
| [docs/需求实现对照表.md](docs/需求实现对照表.md) | 功能边界 |
| [docs/产品方案与路线图.md](docs/产品方案与路线图.md) | 产品说明 |
| [docs/UI设计系统-Fluid-Minimalism.md](docs/UI设计系统-Fluid-Minimalism.md) | UI 规范 |

---

## 技术栈

- 静态 HTML / CSS / JS（无构建步骤）  
- 地图：Leaflet + OSM（免费瓦片）  
- 天气/地理：Open-Meteo 等公开接口  
- 可选离线壳：`sw.js`（更新后请强刷）
