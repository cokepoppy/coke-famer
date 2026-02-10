# **基于HTML5构建高性能2D农场模拟游戏的架构模式与实现策略深度研究报告**

## **1\. 摘要与引言**

在过去十年中，Web技术的飞速发展已经将浏览器从单纯的文档查看器转变为功能强大的应用运行环境。HTML5标准的普及，特别是Canvas API和WebGL技术的成熟，使得在浏览器中构建达到原生应用性能级别的复杂游戏成为可能。农场模拟（Farming Simulation）类游戏，以其复杂的资源管理、动态的世界状态交互以及深度的经济系统著称，代表了Web游戏开发中的技术高地。

本报告旨在为资深开发者和技术架构师提供一份详尽的指南，探讨如何利用HTML5及其周边生态系统（JavaScript/TypeScript, WebGL, IndexedDB等）实现一个高保真的2D像素风格农场模拟游戏（类《星露谷物语》）。我们将深入剖析游戏引擎的选择、核心循环的设计、基于网格的交互逻辑、渲染管线中的深度排序（Y-sorting）、以及大规模游戏状态的持久化存储方案。分析表明，虽然原生JavaScript足以构建基础原型，但采用成熟的框架如Phaser 3或新兴的Kaplay（原Kaboom.js）结合TypeScript的强类型特性，是构建可维护、可扩展商业级Web游戏的最优路径 1。

## **2\. HTML5游戏开发生态与引擎选型分析**

构建农场模拟游戏的第一步是选择合适的技术栈。不同于简单的休闲游戏，农场模拟包含成千上万个可交互的地块（Tile）、复杂的NPC行为树、以及需要精确计时的农作物生长系统。直接操作原生Canvas API虽然能提供最大的控制权，但在处理资源加载、音频混合及物理碰撞检测时会显著增加开发成本。因此，选择一款成熟的游戏引擎至关重要。

### **2.1 核心引擎对比：Phaser 3 vs. Kaplay vs. LittleJS**

在当前的开源生态中，针对2D像素艺术风格的Web游戏引擎，主要竞争者包括Phaser 3、Kaplay和LittleJS。它们在架构理念、渲染性能及社区支持上各有千秋。

#### **2.1.1 Phaser 3：行业标准与全面性**

Phaser 3是目前Web游戏开发领域事实上的工业标准。其采用面向对象编程（OOP）范式，提供了极其丰富的功能模块。

* **渲染架构：** Phaser 3拥有一套混合渲染管线，能自动在WebGL和Canvas模式间切换，确保了在低端设备上的兼容性，同时在支持WebGL的设备上利用GPU加速批量渲染（Batch Rendering）4。  
* **Tilemap支持：** 农场游戏的核心是网格地图。Phaser 3内置了对Tiled Map Editor导出格式（JSON）的原生支持，能够高效解析图块集（Tileset）、对象层（Object Layer）及碰撞数据。这对于处理农场中分层的地形（如土壤层、植被层、建筑层）至关重要 6。  
* **生态整合：** 随着现代前端开发向组件化转型，Phaser 3与React或Vue的结合日益紧密。最新的项目模板展示了如何将Phaser的游戏画布嵌入React组件中，利用React处理复杂的UI（如库存界面、商店菜单），而让Phaser专注于游戏循环的渲染。这种"混合架构"解决了Canvas在处理文本排版和复杂DOM交互时的短板 1。

#### **2.1.2 Kaplay (原 Kaboom.js)：函数式与组合式开发**

Kaplay继承了Kaboom.js的衣钵，主打"组件-实体-系统"（Component-Entity-System, CES）的变体架构。

* **开发范式：** 不同于Phaser的类继承结构，Kaplay采用函数组合的方式。一个游戏对象（如"玩家"）是由一系列属性函数（pos(), sprite(), area(), body()）组合而成的实体。这种模式极大地降低了代码的耦合度，非常适合快速迭代原型的开发阶段 2。  
* **适用性分析：** 对于农场模拟这种系统繁杂的游戏，Kaplay的代码组织方式可能在后期面临挑战，特别是在处理复杂的状态依赖时。然而，其极简的API设计使得处理简单的碰撞和动画变得异常轻松，适合中小型规模的模拟游戏 11。

#### **2.1.3 LittleJS：极简主义与性能极致**

LittleJS是一个轻量级的WebGL 2D引擎，以极小的体积（约10KB）提供惊人的渲染性能。

* **性能优势：** LittleJS剥离了所有非核心功能，专注于在WebGL 2上实现极速的精灵渲染和粒子系统。它可以轻松同屏渲染数万个对象，这对于展现茂密的农作物或天气效果（雨、雪）非常有利 13。  
* **局限性：** 它的极简主义意味着开发者需要手动实现许多高级功能，如复杂的UI系统、高级音频管理或复杂的地图加载逻辑。对于需要深度RPG元素（对话系统、任务日志）的农场游戏，这会增加大量的基础设施代码工作量 15。

**表 1：主流HTML5 2D引擎技术特性对比**

| 特性维度 | Phaser 3 | Kaplay (Kaboom) | LittleJS |
| :---- | :---- | :---- | :---- |
| **核心范式** | 面向对象 (OOP) / 场景管理 (Scene) | 函数式组合 (Functional Composition) | 轻量级 OOP / 过程式 |
| **渲染技术** | WebGL / Canvas 自动回退 | WebGL | WebGL 2 (高性能) |
| **地图支持** | 深度集成 Tiled (JSON/CSV) | ASCII 地图 / 基础图块 | 基础层级渲染，需手动扩展 |
| **物理引擎** | Arcade (AABB), Matter.js | 简易 AABB | 自研轻量物理 |
| **状态管理** | Event Emitter, Registry, Data Manager | 组件状态 | 全局变量或自定义 |
| **适用场景** | 商业级长线项目，复杂RPG 1 | Game Jam，快速原型 2 | 极致性能要求，极小包体 14 |

**深度洞察：** 综合考量农场模拟游戏对地图编辑、UI复杂度和长期维护性的要求，**Phaser 3 \+ TypeScript** 是目前的最佳技术选型。TypeScript的静态类型系统对于管理庞大的物品ID、作物状态枚举及事件载荷至关重要，能有效避免弱类型语言在大型项目中常见的运行时错误 16。

## **3\. 核心架构设计与游戏循环**

农场模拟游戏的运行依赖于一个精确调度的游戏循环（Game Loop）。不同于动作游戏完全依赖帧率，模拟游戏通常包含两个并行的系统：**渲染循环**（负责绘制画面）和**逻辑循环**（负责计算作物生长、时间流逝）。

### **3.1 游戏主循环与时间步长**

在HTML5中，requestAnimationFrame 是构建游戏循环的基石。然而，为了保证模拟的一致性（无论屏幕刷新率是60Hz还是144Hz），必须实施\*\*固定时间步长（Fixed Timestep）\*\*的逻辑更新。

#### **3.1.1 增量时间（Delta Time）的应用**

每一帧的渲染都需要计算自上一帧以来经过的时间（dt）。

![][image1]  
在Phaser 3的 update(time, delta) 函数中，delta 参数即为毫秒级的增量时间。对于移动、动画等视觉表现，直接乘以 delta 可以保证平滑性：

player.x \+= velocity \* (delta / 1000\)

#### **3.1.2 模拟时间的解耦**

农场游戏通常有一个虚构的游戏内时间系统（例如，现实1秒 \= 游戏1分钟）。这种时间流速不应受帧率波动影响。架构上应建立一个 TimeManager 类，专门维护游戏内的“年-季-日-时-分”状态。

* **Tick机制：** 引入“Tick”概念，例如每10个真实秒触发一次“10分钟”的游戏时间推进。所有的作物生长检查、NPC路径规划更新都应绑定在Tick事件而非渲染帧上。这能大幅降低CPU负载，避免在每秒60次的渲染循环中进行昂贵的逻辑判断 18。

### **3.2 场景管理系统**

Phaser 3 的 Scene 系统允许将游戏拆分为独立的逻辑块。一个典型的农场游戏场景架构如下：

1. **BootScene:** 加载配置文件，初始化全局单例（如音频管理器）。  
2. **PreloadScene:** 加载纹理图集（Atlases）、音频文件、JSON数据（物品表、对话表）。显示加载进度条。  
3. **MainMenuScene:** 开始菜单、设置选项。  
4. **FarmScene (GameWorld):** 核心游戏场景，包含玩家实体、地图渲染、物理世界。  
5. **UIScene:** 作为一个并行的场景运行在FarmScene之上（Overlay），负责渲染HUD、时间显示、快捷栏。这样即便FarmScene暂停（例如打开菜单时），UI依然可以响应交互 20。  
6. **InventoryScene:** 独立的库存管理界面，通过暂停FarmScene来唤出。

**架构洞察：** 采用\*\*多场景叠加（Scene Stacking）\*\*是处理UI的关键最佳实践。将UI渲染在独立的场景中，不仅避免了摄像机缩放（Camera Zoom）对UI元素的影响（UI应始终固定在屏幕空间，而世界场景随玩家移动），还简化了事件输入的层级管理 22。

## **4\. 网格世界系统：从数据到视觉**

农场游戏的核心在于其网格（Grid）系统。世界被划分为一个个方格，每个方格不仅有视觉表现（草地、耕地、地板），还承载着游戏逻辑状态（湿润度、肥力、作物生长阶段）。

### **4.1 Tiled Map Editor 的深度集成**

Tiled 是制作2D地图的行业标准工具。在HTML5开发中，通常导出为JSON格式。

* **图层架构策略：**  
  为了实现复杂的遮挡关系和逻辑分离，地图应至少包含以下图层：  
  1. **Ground Layer (底层):** 基础地形，如草地、沙滩。无碰撞。  
  2. **Soil Layer (逻辑层):** 专门用于绘制耕地的图层。初始可能为空，玩家使用锄头时在此层动态修改Tile ID。  
  3. **Collision Layer (碰撞层):** 包含悬崖、深水、墙壁。在Tiled中设置自定义属性 collides: true，Phaser加载时通过 layer.setCollisionByProperty({ collides: true }) 自动生成物理实体 24。  
  4. **Decoration Layer (装饰层):** 花草、石子，通常位于玩家之下。  
  5. **Buildings/Trees (对象层):** 在Tiled中以“对象（Object）”而非“图块（Tile）”形式放置。这允许程序在加载时读取对象坐标，实例化为具有独立逻辑和深度排序功能的Sprite类 25。  
  6. **Overhead Layer (遮挡层):** 树冠、房顶。这一层的渲染层级高于玩家，当玩家走到树后时，会被树冠遮挡。

### **4.2 坐标系统的转换逻辑**

玩家在屏幕上的点击（Screen Space）必须精确转换为网格坐标（Grid Space）以进行交互。

* **坐标转换公式：**  
  设瓦片宽为 ![][image2]，高为 ![][image3]，摄像机偏移为 ![][image4]。  
  ![][image5]  
  ![][image6]  
  在Phaser中，这通过 map.worldToTileXY(worldX, worldY) 方法实现。为了提供良好的用户体验（UX），通常会实现一个“高亮光标（Reticle）”，它将鼠标位置吸附（Snap）到最近的网格中心，提示玩家当前操作的目标地块 5。

### **4.3 动态瓦片操作与状态同步**

当玩家执行“锄地”动作时，不仅视觉上要发生变化，底层数据也必须更新。这是一个典型的**模型-视图（Model-View）分离**问题。

* **视觉更新：** 使用 layer.putTileAt(TILE\_ID, x, y) 方法瞬间替换图块纹理。例如，将草地ID换成耕地ID。  
* **数据更新：** 游戏内存中维护一个二维数组或稀疏矩阵（Sparse Map），记录每个坐标的元数据（Metadata）。  
  TypeScript  
  type TileData \= {  
      isTilled: boolean;  
      moisture: number; // 0-100  
      cropId: string | null;  
      fertilizerId: string | null;  
  };  
  const farmState: Map\<string, TileData\> \= new Map(); // Key格式: "x,y"

  仅仅依赖视觉Tilemap来存储逻辑状态（例如通过检查Tile ID来判断是否有水）是不可靠的，因为美术资源的更换会导致逻辑失效。最佳实践是**逻辑状态驱动视觉表现** 28。

## **5\. 农业模拟机制：作物生长与状态机**

作物的生长是游戏的核心循环之一。实现这一机制需要设计一个健壮的状态机。

### **5.1 作物生命周期状态机**

每个作物实体应作为一个有限状态机（FSM）运行。

* **状态定义：** SEED (种子), SPROUT (发芽), VEGETATIVE (生长期), FLOWERING (开花), HARVESTABLE (可收获), WITHERED (枯萎)。  
* **转换条件：** 状态流转通常由“天数”驱动。  
  ![][image7]  
  如果 isWatered \== true，则累加生长点数。当生长点数达到阈值时，转换到下一阶段。

### **5.2 视觉表现与Sprite Sheet管理**

作物通常使用一张包含所有生长阶段的Sprite Sheet。例如，帧0是种子，帧1是芽，帧2是小植物，帧3是成熟体。

* **逻辑实现：**  
  在每日更新（Day Update）逻辑中：  
  1. 遍历所有作物数据。  
  2. 检查土壤湿度，若湿润则增加生长值，重置湿度。  
  3. 若生长值满足升级条件，更新数据中的 currentStage。  
  4. 调用 sprite.setFrame(newStageIndex) 更新画面。 这种离散的更新模式避免了实时计时的复杂性，并符合玩家“睡觉后作物生长”的心理模型 30。

## **6\. 渲染管线深度优化：Y-Sorting (深度排序)**

在2D俯视视角（Top-down）游戏中，如何处理物体间的遮挡关系是决定画面真实感的关键。如果玩家站在树的前面，玩家应遮挡树干；如果站在树后，树冠应遮挡玩家。这种基于Y轴坐标决定渲染顺序的技术称为 **Y-Sorting**。

### **6.1 Y-Sorting 算法原理**

在渲染对列中，物体的层级（Z-index）由其底部的Y坐标决定。

![][image8]  
这意味着 Y 值越大（屏幕越靠下），物体越靠近观察者，因此应越晚绘制（覆盖在其他物体之上）。

### **6.2 在 Phaser 3 中的实现**

Phaser 3 提供了 depth 属性来控制渲染顺序。

* **动态实体：** 对于移动的玩家和NPC，需要在每帧的 update 循环中动态调整深度：  
  JavaScript  
  player.setDepth(player.y);

* **静态实体：** 对于树木、建筑，需要在创建时设定深度。注意，树木的“底部”应该是树干与地面接触的点，而不是图片的中心点。因此，设置Sprite的 origin（锚点）至关重要，通常设为 (0.5, 1)（底部中心）。  
* **分层渲染组：** 为了性能优化，不应将地图的地面层参与排序。地面层始终在最底层（depth \= 0）。只有玩家、NPC、作物、树木等物体放入一个特定的“YSort Group”或容器中进行实时排序。  
* **特殊遮挡处理：** 对于高大的物体（如房子），可以使用半透明效果。当玩家坐标进入房子的遮挡区域时，通过Tween动画将房子的透明度（Alpha）降低，确保玩家视野不被完全阻挡 33。

## **7\. 库存系统与UI交互设计**

库存系统是连接玩家与游戏世界的桥梁。架构上，它需要处理数据的增删改查以及UI的实时响应。

### **7.1 数据结构设计**

在JavaScript中，库存通常可以通过数组或对象实现。

* **数组结构（Array）：** \[{id: "hoe", qty: 1}, null, {id: "seed", qty: 20},...\]  
  * *优点：* 天然保留了物品的顺序（Slot Order），这对于快捷栏（Hotbar）至关重要。  
  * *缺点：* 查找特定物品需要遍历。  
* **哈希映射（Map）：** {"hoe": 1, "seed": 20}  
  * *优点：* 查询速度快 O(1)。  
  * *缺点：* 无法直观表示“背包的第3个格子”。

**最佳实践：** 采用**对象数组**。每个格子是一个对象，包含 itemId, quantity, metadata（如工具的耐久度）。如果格子为空，则存为 null 或特定的空对象。这种结构能完美映射到UI的网格布局中 36。

### **7.2 UI渲染架构：Canvas vs. DOM**

这是一个经典的架构决策点。

* **Canvas UI:** 使用Phaser内置的GameObjects（Image, Text）绘制UI。  
  * *优势：* 保证像素风格与游戏画面完全一致，不受浏览器缩放影响，统一的渲染管线。  
  * *劣势：* 实现复杂的UI布局（如滚动条、自适应网格、富文本）非常繁琐，且缺乏无障碍支持（Accessibility）。  
* **DOM UI (HTML/CSS):** 使用HTML元素覆盖在Canvas之上。  
  * *优势：* 利用CSS Flexbox/Grid布局极其强大，易于制作响应式界面，可以使用React/Vue等框架管理状态。  
  * *劣势：* 事件穿透问题（点击UI可能误触游戏世界），需要处理Canvas与DOM坐标系的同步。

**推荐方案：** 对于复杂的模拟经营游戏，**混合方案**是主流趋势。

1. **HUD (快捷栏、时间、血条):** 使用 Canvas 绘制，因为它需要与游戏画面紧密结合，且通常很简单。  
2. **复杂菜单 (库存、商店、对话框):** 使用 DOM (React/Vue) 覆盖层。当打开库存时，暂停游戏场景的输入监听，将控制权移交给DOM层。利用CSS image-rendering: pixelated 属性确保DOM中的图标与游戏画风保持一致 38。

## **8\. 数据持久化与存档系统**

农场游戏的数据量随着游玩时间呈指数级增长。由于浏览器环境的限制，选择正确的存储方案是项目成败的关键。

### **8.1 存储技术选型：LocalStorage vs. IndexedDB**

* **LocalStorage:**  
  * *原理：* 同步的键值对存储，仅支持字符串。  
  * *限制：* 存储空间通常限制在5MB左右。操作是阻塞主线程的（Blocking I/O）。  
  * *结论：* **不推荐**用于存储主要存档。仅适用于存储用户设置（音量、分辨率）。  
* **IndexedDB:**  
  * *原理：* 异步的NoSQL事务型数据库，支持二进制大对象（Blob）。  
  * *优势：* 存储空间大（通常可达磁盘空间的50%以上），非阻塞操作，支持索引查询。  
  * *结论：* **必须使用**。农场的状态（成千上万个Tile的数据）、NPC记忆、任务状态都可以序列化后存入IndexedDB。

### **8.2 使用Dexie.js简化操作**

原生的IndexedDB API极其繁琐且容易出错。推荐使用 **Dexie.js** 库作为封装层。

TypeScript

// 数据库定义示例  
const db \= new Dexie('StardewCloneDB');  
db.version(1).stores({  
    saveFiles: '++id, saveName, lastPlayed', // 存档元数据  
    worldState: 'saveId, chunkId, data'      // 游戏世界数据，按存档和区块索引  
});

这种架构允许实现多存档槽位，并且通过异步 async/await 语法流畅地处理存取操作，避免造成游戏卡顿 41。

## **9\. 性能优化与进阶主题**

### **9.1 大地图的性能挑战**

当农场扩展到数万个地块时，直接渲染整个Tilemap会导致帧率骤降。

* **视锥体剔除 (Culling):** Phaser 3 默认支持剔除，即只渲染摄像机视野内的图块。  
* **区块化 (Chunking):** 对于无限或超大地图，需要实现Chunk系统。将地图分为如 ![][image9] 的区块，根据玩家位置动态加载和卸载区块数据。这不仅优化了渲染，也优化了内存占用 44。

### **9.2 寻路系统 (Pathfinding)**

NPC的移动不能是简单的直线运动，必须避开围墙、水域和建筑。

* *A (A-Star) 算法:*\* 是解决此类问题的标准算法。利用 easystar.js 库，可以将Tiled地图的碰撞层导出为二维Grid数据，供算法计算路径。  
* **优化：** 为了避免每一帧都计算寻路，应采用异步计算或分时计算（Time-slicing），并将计算好的路径缓存起来 46。

## **10\. 结论**

使用HTML5实现高保真农场模拟游戏是一项系统工程。它要求开发者不仅仅是编写脚本，而是要像架构师一样思考。通过选择 **Phaser 3** 作为渲染核心，利用 **Tiled** 构建世界，采用 **Y-Sorting** 处理视觉深度，结合 **IndexedDB** 处理大数据存储，并辅以 **React** 处理复杂UI，开发者完全有能力在浏览器中复刻出媲美原生应用的沉浸式体验。

这一技术路径不仅利用了Web平台跨端分发的优势，也通过现代化的工具链规避了传统Canvas开发的性能陷阱，是目前乃至未来几年内Web游戏开发的最佳实践范本。

---

**参考文献与数据来源：** 本文综述了来自GitHub开源仓库、Phaser官方文档、GDevelop教程以及Web开发社区的最佳实践。 引用标识：.1

#### **Works cited**

1. Building a Modern Web-Based Farming Game \- Phaser, accessed February 10, 2026, [https://phaser.io/news/2025/08/building-a-modern-web-based-farming-game](https://phaser.io/news/2025/08/building-a-modern-web-based-farming-game)  
2. KAPLAY Guides, Creating your first game, accessed February 10, 2026, [https://kaplayjs.com/docs/guides/creating\_your\_first\_game/](https://kaplayjs.com/docs/guides/creating_your_first_game/)  
3. I made a farming simulator with Vanilla JavaScript for a hackathon \- Reddit, accessed February 10, 2026, [https://www.reddit.com/r/programming/comments/iqwi7y/i\_made\_a\_farming\_simulator\_with\_vanilla/](https://www.reddit.com/r/programming/comments/iqwi7y/i_made_a_farming_simulator_with_vanilla/)  
4. Phaser \- A fast, fun and free open source HTML5 game framework, accessed February 10, 2026, [https://phaser.io/](https://phaser.io/)  
5. Examples \- v3.55.0 \- tilemap \- Grid Movement \- Phaser, accessed February 10, 2026, [https://phaser.io/examples/v3.55.0/tilemap/view/grid-movement](https://phaser.io/examples/v3.55.0/tilemap/view/grid-movement)  
6. Modular Game Worlds in Phaser 3 (Tilemaps \#2) — Dynamic Platformer | by Michael Hadley, accessed February 10, 2026, [https://itnext.io/modular-game-worlds-in-phaser-3-tilemaps-2-dynamic-platformer-3d68e73d494a](https://itnext.io/modular-game-worlds-in-phaser-3-tilemaps-2-dynamic-platformer-3d68e73d494a)  
7. How To Make A Zelda-Like Game With Phaser 3 \- Part 27 \- Collision Layers \- YouTube, accessed February 10, 2026, [https://www.youtube.com/watch?v=hkixvEDvir0](https://www.youtube.com/watch?v=hkixvEDvir0)  
8. Phaser 3 and React TypeScript Template, accessed February 10, 2026, [https://phaser.io/news/2024/03/phaser-3-and-react-typescript-template](https://phaser.io/news/2024/03/phaser-3-and-react-typescript-template)  
9. Phaser and Vue 3 TypeScript Template, accessed February 10, 2026, [https://phaser.io/news/2024/02/official-phaser-3-and-vue-3-ts-template](https://phaser.io/news/2024/02/official-phaser-3-and-vue-3-ts-template)  
10. kaplayjs/kaplay: A JavaScript/TypeScript Game Library that feels like a game. \- GitHub, accessed February 10, 2026, [https://github.com/kaplayjs/kaplay](https://github.com/kaplayjs/kaplay)  
11. KAPLAY.js, HTML5 Game library for JavaScript and TypeScript. Free & Open Source., accessed February 10, 2026, [https://kaplayjs.com/](https://kaplayjs.com/)  
12. Ask HN: What Are You Working On? (December 2025\) \- Hacker News, accessed February 10, 2026, [https://news.ycombinator.com/item?id=46264491](https://news.ycombinator.com/item?id=46264491)  
13. LittleJS/examples/breakoutTutorial/README.md at main \- GitHub, accessed February 10, 2026, [https://github.com/KilledByAPixel/LittleJS/blob/main/examples/breakoutTutorial/README.md](https://github.com/KilledByAPixel/LittleJS/blob/main/examples/breakoutTutorial/README.md)  
14. KilledByAPixel/LittleJS: Tiny fast HTML5 game engine with many features and no dependencies. \- GitHub, accessed February 10, 2026, [https://github.com/KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS)  
15. LittleJS Example Browser, accessed February 10, 2026, [https://killedbyapixel.github.io/LittleJS/examples/](https://killedbyapixel.github.io/LittleJS/examples/)  
16. lambdavi/lambda\_game: A Stardew Valley Clone \- GitHub, accessed February 10, 2026, [https://github.com/lambdavi/lambda\_game](https://github.com/lambdavi/lambda_game)  
17. \[Part 1\] Building a 2D RPG inventory system from scratch in Phaser 3 \- UI Grid Scaffolding, accessed February 10, 2026, [https://www.youtube.com/watch?v=Yma-IddcyMM](https://www.youtube.com/watch?v=Yma-IddcyMM)  
18. Smart Farm Simulator | AWS Builder Center, accessed February 10, 2026, [https://builder.aws.com/content/2q33wVw9wH6Uroj9k8jL3q5AqfL/smart-farm-simulator](https://builder.aws.com/content/2q33wVw9wH6Uroj9k8jL3q5AqfL/smart-farm-simulator)  
19. Create a day night cycle \- javascript \- Stack Overflow, accessed February 10, 2026, [https://stackoverflow.com/questions/65037486/create-a-day-night-cycle](https://stackoverflow.com/questions/65037486/create-a-day-night-cycle)  
20. Scenes | Phaser Help, accessed February 10, 2026, [https://docs.phaser.io/phaser/concepts/scenes](https://docs.phaser.io/phaser/concepts/scenes)  
21. Game states in Phaser 3, accessed February 10, 2026, [https://phaser.discourse.group/t/game-states-in-phaser-3/285](https://phaser.discourse.group/t/game-states-in-phaser-3/285)  
22. Overlay Vs Canvas & GameMode Vs GameState : r/unrealengine \- Reddit, accessed February 10, 2026, [https://www.reddit.com/r/unrealengine/comments/1bxb9u6/overlay\_vs\_canvas\_gamemode\_vs\_gamestate/](https://www.reddit.com/r/unrealengine/comments/1bxb9u6/overlay_vs_canvas_gamemode_vs_gamestate/)  
23. 3 Different UI Layouts. Let's take a look at Canvases. We are… | by Fran-Kee Brown | Medium, accessed February 10, 2026, [https://medium.com/@fbrowndev/3-different-ui-layouts-bb2e3c1898cd](https://medium.com/@fbrowndev/3-different-ui-layouts-bb2e3c1898cd)  
24. Examples \- v3.55.0 \- tilemap \- Set Colliding By Property \- Phaser, accessed February 10, 2026, [https://phaser.io/examples/v3.55.0/tilemap/view/set-colliding-by-property](https://phaser.io/examples/v3.55.0/tilemap/view/set-colliding-by-property)  
25. createFromObjects gid property in Tiled \- Phaser 3, accessed February 10, 2026, [https://phaser.discourse.group/t/createfromobjects-gid-property-in-tiled/1722](https://phaser.discourse.group/t/createfromobjects-gid-property-in-tiled/1722)  
26. Examples \- v3.85.0 \- tilemap \- Grid Movement \- Phaser, accessed February 10, 2026, [https://phaser.io/examples/v3.85.0/tilemap/view/grid-movement](https://phaser.io/examples/v3.85.0/tilemap/view/grid-movement)  
27. Interactive grid \- Phaser 3 \- Discourse, accessed February 10, 2026, [https://phaser.discourse.group/t/interactive-grid/5405](https://phaser.discourse.group/t/interactive-grid/5405)  
28. fariazz/html5-farming-demo: a simple HTML5 farming game demo \- GitHub, accessed February 10, 2026, [https://github.com/fariazz/html5-farming-demo](https://github.com/fariazz/html5-farming-demo)  
29. Farming Like a Coder: Writing Logic That Grows Trees and ..., accessed February 10, 2026, [https://medium.com/@hanxuyang0826/farming-like-a-coder-writing-logic-that-grows-trees-and-pumpkins-and-code-skills-1e06e6e7bd4f](https://medium.com/@hanxuyang0826/farming-like-a-coder-writing-logic-that-grows-trees-and-pumpkins-and-code-skills-1e06e6e7bd4f)  
30. Growth Mechanic for Crops \- RPG Maker Forums, accessed February 10, 2026, [https://forums.rpgmakerweb.com/index.php?threads/growth-mechanic-for-crops.176792/](https://forums.rpgmakerweb.com/index.php?threads/growth-mechanic-for-crops.176792/)  
31. Need help on crop-growing script : r/gamemaker \- Reddit, accessed February 10, 2026, [https://www.reddit.com/r/gamemaker/comments/4buznm/need\_help\_on\_cropgrowing\_script/](https://www.reddit.com/r/gamemaker/comments/4buznm/need_help_on_cropgrowing_script/)  
32. Farm with Code / JavaScript by Igor Konyakhin \- Itch.io, accessed February 10, 2026, [https://nns2009.itch.io/farm-with-code](https://nns2009.itch.io/farm-with-code)  
33. How to use Y Sort on your Scenes and Tilemap Layers \- Godot Tutorial \- 2D Top Down Game \- Pt 9 \- YouTube, accessed February 10, 2026, [https://www.youtube.com/watch?v=9UoIZ5yUMnc](https://www.youtube.com/watch?v=9UoIZ5yUMnc)  
34. Setup Tilesets, Top Down Y Sorting, and Cinemachine Follow Camera \~ Resource Gathering Game \~ Part 8 \- YouTube, accessed February 10, 2026, [https://www.youtube.com/watch?v=HcViY3wEqe8](https://www.youtube.com/watch?v=HcViY3wEqe8)  
35. Examples \- v3.85.0 \- depth sorting \- Sprite Depth Index \- Phaser, accessed February 10, 2026, [https://phaser.io/examples/v3.85.0/depth-sorting/view/sprite-depth-index](https://phaser.io/examples/v3.85.0/depth-sorting/view/sprite-depth-index)  
36. Storing things in objects vs arrays in JavaScript \- Stack Overflow, accessed February 10, 2026, [https://stackoverflow.com/questions/43723852/storing-things-in-objects-vs-arrays-in-javascript](https://stackoverflow.com/questions/43723852/storing-things-in-objects-vs-arrays-in-javascript)  
37. Array vs. Object: Choosing the Right Data Structure and Comparison | by Weiwei \- Medium, accessed February 10, 2026, [https://medium.com/@wutamy77/array-vs-object-choosing-the-right-data-structure-and-comparison-6ffb98602216](https://medium.com/@wutamy77/array-vs-object-choosing-the-right-data-structure-and-comparison-6ffb98602216)  
38. DOM vs. Canvas | kirupa.com, accessed February 10, 2026, [https://www.kirupa.com/html5/dom\_vs\_canvas.htm](https://www.kirupa.com/html5/dom_vs_canvas.htm)  
39. 5 Reasons to Use DOM Instead of Canvas for UI in HTML5 Games \- Pocket City Blog, accessed February 10, 2026, [https://blog.pocketcitygame.com/5-reasons-to-use-dom-instead-of-canvas-for-ui-in-html5-games/](https://blog.pocketcitygame.com/5-reasons-to-use-dom-instead-of-canvas-for-ui-in-html5-games/)  
40. HTML5 Game Tutorial: Game UI – Canvas vs DOM | \- HTML5 Gamer \- Steven Lambert, accessed February 10, 2026, [https://blog.sklambert.com/html5-game-tutorial-game-ui-canvas-vs-dom/](https://blog.sklambert.com/html5-game-tutorial-game-ui-canvas-vs-dom/)  
41. Best Practices for Persisting Application State with IndexedDB | Articles \- web.dev, accessed February 10, 2026, [https://web.dev/articles/indexeddb-best-practices-app-state](https://web.dev/articles/indexeddb-best-practices-app-state)  
42. How to Use IndexedDB to Manage State in JavaScript | by Craig Buckler | StackAnatomy, accessed February 10, 2026, [https://craigbuckler.medium.com/how-to-use-indexeddb-to-manage-state-in-javascript-50ac358d896c](https://craigbuckler.medium.com/how-to-use-indexeddb-to-manage-state-in-javascript-50ac358d896c)  
43. How would I model a file system in dexie.js? \- Stack Overflow, accessed February 10, 2026, [https://stackoverflow.com/questions/54139010/how-would-i-model-a-file-system-in-dexie-js](https://stackoverflow.com/questions/54139010/how-would-i-model-a-file-system-in-dexie-js)  
44. How to manage big maps with Phaser 3 \- Dynetis games \-, accessed February 10, 2026, [https://www.dynetisgames.com/2018/02/24/manage-big-maps-phaser-3/index.html](https://www.dynetisgames.com/2018/02/24/manage-big-maps-phaser-3/index.html)  
45. Top-down Infinite Terrain Generation Tutorial \- Phaser, accessed February 10, 2026, [https://phaser.io/news/2019/03/top-down-infinite-terrain-generation-tutorial](https://phaser.io/news/2019/03/top-down-infinite-terrain-generation-tutorial)  
46. Phaser 3 vs Kaboom.js in 3 Examples \- YouTube, accessed February 10, 2026, [https://www.youtube.com/watch?v=g4slFm0lows](https://www.youtube.com/watch?v=g4slFm0lows)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAiCAYAAADiWIUQAAACvklEQVR4Xu3cz4uVVRgH8BNmGIm0jEQpQjcRtHRjFEK1UCJoIYRgUVi5CEKwhemohYmLJNqIUIssEcSFBuEiwfwFLQsy/ANaBeHGghb2PJxzmdeXe52J+840A58PfDnvOefOmXfu6uGcw5QCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsFSsityLr+hMAACwNv0Reivwdebw3l65FbvQHp5DrLUePRI70BwEAFsPXrb0b+aw70fwT+bQ/OIVcbznKovbl/iAAwEJ7pfP8balFW9fFUgusbNf25v6r98qw6y2mE5G/Sn3vb3pzAAAL6uyY/qFOf+hjwKHXm0vez5vksVKPgMdlnG4x+0QZ9pgYAGCiZ8f0/+z0Xyz1KHAoQ683l6P9gY7cKTs9IeP0j3K/7PUneaY/AAAwXz/0B5rcScqdsHS9M/5g5znlfa5998k4o/Wy2Mn1Hii1iHs78nTkcJt/p7XHIm+Wut6W9pkP2tzDkdcjW0stAg9GdpW6Xsr7eHk/7/nWn0Z+H1n8PRr5vNSdu/VtLnfqdkc2t/5DkddK/X7y2Pdm5K02BwAwb+dLLcwm5ffIysiHpd7f+qT+2NRG641cbe2myFNldndrf2tHvzd3qZ6MbCu1UEvflVqgZXGUxdOPbfzX1u5t7RCysPw5sr3193TmZkp9tz9a/0ypf9foaPW31gIALJjV/YEpddfLAm4kd6Zut+cXWnultSkLtTWd/qtldq2cu9OeR3fkvm/tUEY7aulCa/Odn4vsjJxrYxsjJyPvt363QAUAWHayqNoReaPUY8ZLkQORL0r9R76XZz96T3GX8jPvlnoEmnN5JJpyVy53vH6KfNTGhpbHyRvac77v8cip1p+JfFxqMZe+iqxqzwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwP/kX59IZePojQQLAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAABVElEQVR4Xu2TvytFYRjHv34kl4lFyoBMJkVKMiqjBVH+gIvJoChlEZsMFkU3ZWIy0E02m0Fd3VJ+ZpZBYvLj+3ieo/c+znUsJvdTnzrv99vzntM57wFK/BVn9JZe0Gt6Q1toLc3bOupyNPU5BaTpHXRW3LT8iyX6Tmdpmet2rJugFa4bope0E9/nMAUdnPEFWYN2o76Adj0+jBiDDi67vIE+WjfpunaacVkBA9DBdZfLesO6edft0iaXFdANHZT3F9EB3XDYupWgk4dYCNaxtEEHj4JsjzbSfusyllfSLK2xdVHqoYOnth6kc3bdZZ3cRJCPOm7XP1JO36Dnrooe0mrrWqGbHtM6eoCY41OMB/pEp+lIkMtGsqn8CKu0N+gSuYIO77tcnuqVPtNt1yVyAn0FchI89/SFNrs8EfmiWz40zumiD39DH/QUxCHnMvEIlfjvfADWbEg92dj82wAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAYCAYAAAD3Va0xAAAA/klEQVR4Xu2Tv0qCcRSGXyRnhfAOrL3JURDBQRo0aGkUu4QuwxAnJydpbpAo8AaEhgYXK0yQamsIdOrP+/McPuRNpW//HnhweI7Hj6MCCXEp0Wf6Qqf+OqEV70P6RB/X7HjbyDX9oWUN5BTWejQt7Q/v9JPuaSAt2KITDcohbPBGg3NPv+m+BqUJW3ShgWTpF33QsIk+bNEZ7OkOaN5teGtH0zuY0wW9XfPODbcLi2rR9BbCp4fBgQbn3/c5x/b7ZBDjPlewRQUN5Bgx7rPr93MJW1TXoBzBBsNxlRQdw3pOWkQR9v/5gH1b4YlmtApbMKKv3pb0jXZX70xIMH4BCVZB68f13h4AAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEQAAAAYCAYAAABDX1s+AAAD4UlEQVR4Xu2YaahNURTHl3meZ0LIPCSZiUL5YAgZyqeHjJlnITOZQvKBZEyGKFGGyJPIlKEIISK+oGQIkeH/t865d991zrn3vXdv78Pr/epf967/vmefs8/ea699RQopJC9UgcrYYAGhJFTDBpNRF7oJVbKGoSjUBOoPtTZeM/M90/Ch2kIDoDpOvCJU2/keBl/0dailNcIoBd2AxljDgTczE3oHPYH2Q0ehw1BjaAc0P9Y6s9SEtkNfoVvQLugUtA2qJXrvnWOtoxkEvRC9XlI2QbehItbw6AO9FJ1BfEMuXaAv0F+oq/EywQzoM3QQqm48vgD2TRU3XhRnoUM26MLpxg67W8ODD8w3w5nA5RLGY9E2JayRJlNFB3qyNTy4TP5A562RhObQDwku9xh8Aw9t0IM//gA9gMoZz2ULdM4G02Sk6MPusYbhHrTQBlNwSXS5hXIBOmmDHmdE39BoaxgWQQtsMA04+O9F+65nPAtnB2dxbmAOipoE8lw0h1g6it7QL9HtOBlMbBVsMA3mivZ9xxohMKFH5b4omHt4/arWKAb9hCZZA6wT/VG2NfIBbo/se5k1MsQw0esH8khDz+hrDdFlRG+2NfKBj6J9d7BGhmgnev3e1mCHUR1flZxtpYOh4TaYBtyp2O93a4SwWvSl5pb6on30s0Yjzwh7IBZe9AZaw4F7/30J1gfp8kq07/LWcGC1fM0Gc0gv0es3tQYTIY2wbYulOb2N1nCYJcHqlA/h7zqcmnOgbgktNJklK7X9/MUSPQzWQ8egHk6sFbRS4n2x+h4XtxMYC/0Wrb4DvIF226Bo5j4hOnWzJPHH/MzaY6cTIxyMtaLTfi90HJoIHXAbiVa9rC6jzj7VoGfQU9Eq2YUDyWozy4lxc+DyYeyIF+NgZvsNDLzH1zbosw+6bGI+PBDxjMKt9y20xvvO2iVs9Lk2/TfPHMSbYqxyrIXCqpcDEnYNHy5n1hicKXehpaIDy8GwM45lAZcQrzvFi22GVsVaJMLZxRorFOYPFkGlreHA4ogPlwX1lOgS3oeF1TfRY0EUrEQn2GAI3BpHiBaHgW3SgbP2E9TA+85BDCRN0Xvn7BtqDR82eAQttkYe4Pa9QjQRM9kSnkKZjyxcbpwFmaKFxJcBkzyXetm4HWO8aNLmMouEx2JO4VRlcir41pk7NoieF6ZD8xJaKJ0kxYkzD/AB2SfrptPQlUT7P1y6/PuCMy4lS0SP2OnCZcKEzJkXtWRGiSbOTMJ6iUuVD+3mEpetojtYjlkuma8p8gv+adUeGgJdlOD/I/wncL2kzn8FhjbQNNHEbwejkNzyDxp1rxD5lVKxAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAtCAYAAAATDjfFAAAFOklEQVR4Xu3daeimUxjH8cu+jyUiFG+kiReUtYhJwgskkSVjKMnywpKdQvYUkcgaETENRoZB9uxFSQ0yJi9IKS9sZRmun3OO5zzX3M/273nmcf/n+6lf//s+9/NfZl5dnXPu65gBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQIPtPPM8a+X7XatnAAAArXOCZ0XOcs9J9cMWOsrzredpz/OWCrfnuj4BAADQQpqJ+smzXnwwRod6DouDQ7okDjTY2rPMs2UYv9uzfxgDAABond08S+LgmN3o2TQODum6ONDgfc/PcdAd7Vk3DgIAALTNU569q/tFnictzYo947nHOjNX53ru8FyUs9CzYX52pWf3fH2c5y/PHM9bnr89S/OzUd0QB4KNLf38I+MDt0kcAAAAaBvNrqnYqe3iOdlzUHV/Zr5e4NnGUnEm23pu91zvOd+zcx7/3vNQvlbB9Ue+HoaWZrevcme4j87zLI6DAAAAs8U5tmrBJvd51s7XZ1v3m5bHeg7I14d4rsrX7+Wvop95er5+x/Nu9WyQfTyPV/ks3G/Q+ei/tGR6aRiTHTw3xUEAAIC20UyYXjioqdCpizgtbWof2MP5/tPqWX1df893+evmefwIz8H/PTW72bOfpWXVQQYtiW7h+SAOumet09rjMksvL1xovIQAAABaRsXUy2HsxDxe6PpUzwWW3sZcaWnZUvvZfgyfk7melyztLSvjO3pezfdneHby/O75Ko/1M6hgE/2OW6r7BZYKOdHLDvp7tUSrpd1H8nhU/l4AANBi61vaL6X2EZpt0vLcXZ6L6w810KZ87fWK1B/sT5t5u4thaYlxFJtZd/FSlkZF/95frfdmfhViomJJDWxF31/GC+15qwusfoYp2ESzeadZ89+mMf3d/ejlCwAA0GL7ep6wzhJboVYSg/qXaaP8OnEwezsOTMCoBVsvKsI0k/VofDAC/f+9YulFgvs9e3Y/nojjLRWHmuHrtwRLwQYAQMv94NkoDroX48AINIulZcFJG1fBpn1omll8LD6YIc2IrS4qFOuZwiYUbAAAtNheljbeN9HyoWh59EFLMzha7vs8j6thrI5Kqqn9hd6s1Eb5Xj93nMZVsM12FGwAALSYiq4342BwraWeZlp2+9DSfikt96nx7BfV567w/JavtZz6cfVskDca8pql3/lC9bmIgm04FGwAALTY65ZaUBSXW3oLUvu5tBer0Axb07JbfWSSvke9y8q1jk6atKaCTb97TU9EwQYAQIsdY+k4puiX6jr2LitUkM3zXJPv6+ayn+Sv5YUE9SY7xXpvjNfpAr2iPmO9NBVsWBUFGwAALRf3mt1maZatiL3LilstbXjX8U5S+o6pF5k28JfWF6U3mU4QGKY32Sgo2IZDwQYAwCygw9DnW2rEGsXeZbXyYkKhwkzUm60+ZkkvK0wCBdtwKNgAAEBf6m32Ub4uZ3OOy7QLthWeLz1fW2pgq7NBdb/cUquUszzf5M9pH+C0ULABAIChxMa846CCTactDGrwOyk6wiouF+tey8iFTlCYFp1goZnORfEBAADAmuJw6y7Y7s33ZSZxoaWzRgEAADAlmuErBdsengfyvV7ckKvzVwAAAEzJVtYp2NTDTnS/2NJyKQAAAKZMzYRXWtorpr10ooJNB9/3O6EBAAAAq5F6yy2p7tXXTsd3AQAA4H9iabhfZpPrOwcAAIAZODDc683RXo2GAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgNnvH/aRDmPRS6LqAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAtCAYAAAATDjfFAAAFBUlEQVR4Xu3dW4hVdRTH8WXZ/X4xqYimexhh0vWph6J6CKKohIhqguhGYfQQhUYURkqURNFL9VAk3SGKHpLuSNqFSoUyJEofJCMCxS4kWOvH//+n/6zZ09nmzJzZp+8Hfpx91tnjGX1xsff/v7YZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADQ4znNR9f7E6hgAAKCTVnjWe773fBw+65o7PGs9z3pe8BzruWvEGQAAAB31l+fuWBxnagx31DTP0lhscLZnq2eXUP/Gs1uoAQAAdJIatrNicRzt61kUiy1M9yyLxQY/e9bEolsSCwAAAF10iuet6v09lm4pXu950tItxfPzZ6d5XvQ843nIs9DSmjFRc3RLPj7K81s+ftuzMb8emWtt7W69G7YzPNs8B8UP3MxYAAAA6KJXbOTVtcstNVb3VTWtB5OH8+s75QP3ledazxzPcK69bGlNnOzj+TMft3Gw54icIc+H1Xslet1zZywCAAAMCq0R+8mza6hf7Tk9H8/y3FR9dqhnQT7ew/NuPtYtz3KVa5PnuXx8oaVbrm0tttQgKi95fqzel8axttxzTiy6SzxXxCIAAEDX3GrNzdS66vjr/PpYfn3c0q1KecJzYD6u/xwdn+y5wNLO009yXWvSdL6uyEl5HUubW6Ia4VGu/NXK7tD4fVpPBwAA0Blv2OiG7fBQ07HWqb2W32txv87RFbhfy0mWFv7Lfp7fLV210+1QXSF72nNj/vzeXJP655u0adh0lVDfN5zf62fqzQbx+3RVEAAADLDDLI2P+NRSs6NF7StHnNHsOmteAP+mpYaoHvTab7oKptuetTIa40pLv6+apHgbVU6wVFdTdExVn1EdyzX5VZsW/k2bhq3QurthGz3aQ9p8X/wdAQBAB6lRKbsgi+2Wdj/2MteaGxz5PBamKP3+GrA7HrPNdHv1Uc9e8YMJ0ub7aNgAAOg4NVxPxaL70nZu4OzenkdicYo62tK4j+c9+4fPdsSQ5wDPzaE+UYas3ffRsAEA0HFxnVehRx/p9qBoB+MWS3PKHqzqWqRf1m8V33petXRrtWl+2CDTbeXbbPRt14nS9vto2AAA6LixGrbiXM8Dls7b0/OZpdtvmk0mGk9RzLe0vkvzxrQerq33LM0kq/N+rpfRGvjvaNgAAOgwLcL/I9R0NU01jb+4oar/Uh0X2rFYRkloDEZp/s6rjiebvvf/noiGDQCAjmv6Dz7WtEtxXqiJztOt0/s9H9g/u0o/svSUAI280IJ+XaGTscZO6MqcBtaOFewcGjYAADpOuyM18b/QovvYsF3lmR1qoqn/2qWokRdqur7Lde0w1SJ+PcZJDdtwrl+cXzG5aNgAABgAx3su9ZxqzWMtNDC2SdNk/fJ0gHo22+b8+kVVw+ShYQMAAD1tsLSTUVP7B5Ee0v6DpYfCa2CwrLW0DlBXHfUoq36iYQMAAD3pMU7azKDne4437VzVUwPKqJF+0W3kem6drjTqUVf9pDWD+vehYQMAAD3dbmlH6iDTnLr676inD1xWvQcAAEAfadPFCs9J+VhrAld5DqlPAgAAQP8s9ZwZanGnLQAAAPpoo6XxJTUaNgAAgCkkNmd6hurqUAMAAEAf6CH3GlmicSXLck1jPLQBQbPn6oHEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAF/A1qm/6VHwHjmgAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,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>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAiCAYAAADiWIUQAAACFUlEQVR4Xu3cP6iOURzA8UMGRZG/dzFZTEopgz+JgbpiIgblTwZkYLFYySAGBnew2GSxGZhMwuLPgnANQolEBuXP73TOm+NJ17297/Tez6e+Peec53nvXU/P+zxvSgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDB6E72NXkevonfRlr+umLpN0cvoWfQ0ml3XH0Xj9RwAAJOwLlrUzH9Es5p5v35Gc5r5vWhVMwcA4D/ONuP10YNmPgh3ot11nDeCo805AACmIH8d+qG7OAALo+/Rguhi5xwAAJN0O9pRx71nzQbpV/S4mc+I3jfzrpndBQCA6SxvnvKGqmdvMx6U/PcPd9aed+at8fTnubdDzToAwLRzNJXNVN609Txsxq2t0akJmsi/7qaNRTvrOP//89Gu6Ewqm7n8bN2F6Eu0sV63rJ7P9kdLokvRimYdAGBozEvlDc7P0cdUNm75DdG8+RmU/BLDp+hr9KJZX12Pd6ODqWzMsnOpvJgwUucno8t1nH9qZGk0N5U3W+en8lzc8ehqKpu+lfVaAAD6dKQev0UborV1fj9aU8fZzWhPHd+qx95bppvr8Ua0L5XPtXcKAQDoQ76Dlu+e5TtkWf569Fq0ONoeXYmWp/KbbafrNdejY9GBOs+buexJPZ6IttUxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwJH4DyHxIUnfYCuoAAAAASUVORK5CYII=>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAAXCAYAAABTYvy6AAAB7klEQVR4Xu2WSygFURjHP3mVQgoJhZSwkTxKKRsWLCws5Jk8VlaSDVmxkZSNx9LWqyR5LJQSNrJj45FShIWFsmCB/9eZ0cyXc8fkXJH51W9x/+fMN9+ce+65QxQQEPDfyIYdMhQkwGY4BAvF2E+STd/stQCOwSP4Ctfdwy7q4SXshDXwApa6ZoQXo72Wwy5YAp9JX6wIPsBc63MVfIOTHzPCT9h61RWLgldwwZHFw3FY7Mh05MhAkAEjZeiB0V51xXgFecX6YATMIn+NzsMmGVqUwR0YJwc8MNqrrlg3qWIjcAPOwXvY65wUghi4CttEzlt3FyaL/CsY7VVXbIZUsVMYa2X2yjbakzzg69Zgu/WZH3oPpnzM8IfRXrkYr5JkidSFwyK/hYciC4X98KNwH6a6h31htFcutilDME2qWIvIz63cz7dWDZ9gvxzwidFedcUGSF3UIPIzK08TuY5KeADT4TJ5v4CEwmivXGxLhiCf1EU9Ir+BJ6ROTy/sh7ZXPJrUtrR/834x1is38kLqlOX/Qsk2uQ+TPFI3qHVkOiro89Ob77kIW0XuhZFe60htg2v4aHlH6lRMdMzjLXIMV+AEqRUcdIyHYhYmydCCG58i9V7txU/0+im8Tfi9l18bM8XYb+Mv9RoQEBDwfd4BeVCbNoDRf2IAAAAASUVORK5CYII=>