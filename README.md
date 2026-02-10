# coke-famer

目标：用 HTML5/Phaser 复刻“类星露谷”的核心玩法（先做可运行 MVP 骨架）。

## 截图

![World](docs/screenshots/01-world.png)
![Farming](docs/screenshots/02-farming.png)
![Inventory](docs/screenshots/03-inventory.png)

## 运行

1) 同步参考仓库资源（从 `generative_agents` 复制到本项目 `public/ga-assets`）

```bash
npm run sync-assets
```

2) 安装依赖并启动开发服务器

```bash
npm install
npm run dev
```

## 操作

- 移动：方向键 / WASD
- 工具：`1` 锄头 / `2` 喷壶 / `3` 种子 / `4` 手
- 使用工具：鼠标左键点击地块
- Sleep：推进到下一天（会触发作物生长结算并自动保存）
- 时间/体力：每次动作消耗体力并推进时间（HUD 顶部显示）
- 自动时间：游戏内时间会自动流逝；`P` 或 HUD 的 Pause 按钮可暂停/继续

## 资源与许可提示

本项目默认通过 `npm run sync-assets` 复用本机路径下的 `generative_agents` 资源文件用于本地开发验证。  
其中可能包含第三方美术资源（例如 RPG Maker/CuteRPG 等），**请勿在未确认许可的情况下对外分发或商用发布**。
