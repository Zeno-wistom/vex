# 一方水域 · VEX AIM 互动装置 V4

浏览器模拟原型：GPU 高度场湖面、90 条群游鱼、四个岸边投影装置和视觉驱动巡湖机器人。开关、Tag 观测、机器人和 Kicker 均为模拟。

## 运行与使用

```powershell
npm run dev
```

- 展示模式 http://127.0.0.1:5173/ 。点击岸边装置或其底部拨杆切换开关，Tab / Enter / Space 同样可操作。机器人始终可见，底部可开关摄像头视野、进入全屏，F 也可切换全屏。
- 调试模式 http://127.0.0.1:5173/?debug=1 。提供四个独立开关、完整演示、暂停、重置、全屏、故障注入和状态记录。面板可折叠。
- 投影预览 http://127.0.0.1:5173/?view=projector 。显示四个独立竖直板，开启时显示官方 Tag 图案，关闭时板面熄灭。该模式是结构预览，尚未进行实体投影映射或校准。

同一浏览器来源只允许一个湖面控制页。切换展示与调试请在同一标签页导航，投影页可另外打开。不要混用 localhost 与 127.0.0.1。保持控制页前台，刷新会重置模拟。

## 完整交互

开关 ON → 投影模块与板面 Tag 亮起 → 湖面边缘光区渐亮、鱼群聚集 → 机器人在中央椭圆内自然巡逻扫描，摄像头看到 Tag 后锁定 → 连续转向瞄准 → 根据 width 接近与减速 → 连续六帧达到停止阈值且对准 → 静止 → 短柱 Kicker 伸出并检查底部拨杆接触 → OFF → Tag 消失、光区渐暗、鱼群散开 → Kicker 收回 → 掉头离开 → 返回途中停下回望 → 连续六次检查 → Tag 消失则转回中央区域并继续自然巡逻。Tag 重新亮起时重新锁定、瞄准、接近和关闭。

多个装置同时开启时处理首先实际看见的目标；同一时刻首见多个 Tag，优先视野中心较近者，锁定后不被其他目标打断。调试待处理列表只供观察，不作为机器人选目标的输入。Tag 丢失当帧停止位移，持续两秒取消任务。Kicker 最多尝试两次，无法触碰的目标保留 ON 并标记故障。重新 OFF→ON 清除故障。

## 水面、鱼群与回头检查

水面采用独立 Three.js/WebGL2 画布，在 256 级网格上用两个 FBO 交替更新高度与速度；四邻域离散波动方程负责传播、叠加及阻尼。V4 增加一次上传的程序化水底纹理、深浅与水草阴影、缓慢的多尺度起伏、由法线驱动的水底折射、独立低分辨率动态焦散通道、太阳高光及波峰方向性明暗。焦散随水面高度场和灯光变化；灯光不注入物理波纹。普通鱼、破水鱼及机器人共用 `ripple.emit({x,y,radius,strength,direction,type,sourceId})`。事件队列最多 64 个，单步最多处理 12 个，默认事件幅度上限 0.035。尾流后方的少量接触泡沫、鱼破水时的气泡和有重力的抛射水滴由同一事件触发。无 WebGL2 或半浮点目标支持时显示 Canvas 2D 降级湖面。水面由同一固定 60 Hz 时钟驱动，暂停、重置、resize、后台恢复和 context 恢复均纳入生命周期。生产渲染没有每帧 GPU 到 CPU 回读。

鱼群仍由 CPU Boids 维护默认 90 条，加入种子可复现的个体差异、速度变化、短暂停留和趋光目标滞后。浮出鱼经历上浮、短暂破水、下潜，身体随深度改变尺寸、明暗和背部高光；尾鳍按游速摆动，转弯时身体弯曲，停留时胸鳍继续活动。单次最多两条同时浮出；普通游动仅间歇产生弱扰动。水草和鱼群的微小漂移共用同一流向。

完整状态顺序为 PATROL → DETECT → LOCK → ALIGN → APPROACH → STOP → KICK → VERIFY_OFF → RETREAT → LOOK_BACK → TURN_BACK → RETURN → RESUME → PATROL。

回望前先停止位移并转向刚处理的板面。每隔 0.12 秒采样，连续六次一致才作判断。可见 Tag 则进入 RELOCK → ALIGN → APPROACH；板面处于可观测范围且连续未见 Tag 才确认消失。遮挡、距离不足或传感器故障会显示未确认，超时返回巡逻。

默认一次任务允许两次回头重新锁定，每轮踢击最多两次。达到上限时隔离目标并恢复巡逻，手动 OFF→ON 可清除故障。上限为演示策略，可在 scene.ts 中配置。

打开调试模式，点击“运行完整交互”。等状态变为 LOOK_BACK 时再次打开西湾，观察回头结果显示“Tag 再次出现，重新锁定”；保持关闭则显示“连续确认 Tag 已消失”。

展开“视觉效果测试”可重复触发强波纹、交叉波纹、鱼浮出、加速尾流、停止冲击波与西湾灯光。其按钮调用正式场景的事件与鱼群代码；水面质量、波纹、焦散、尾流、水花和浮出频率滑杆仅在调试页出现。

展开“模拟参数”可修改 FOV、识别距离、W_slow、W_stop，点击“应用模拟参数”。仅在 PATROL 时接受修改，任务中会给出提示。参数改变保留固定 Kicker 行程，停止点过远而无法触碰时按失败重试处理。重置清除场景状态并保留当前调试参数，刷新恢复配置默认值。

## 模块与模拟参数

- `src/config/scene.ts` 定义装置、tagPose 高度、switchPose、approachPose、kickerReach、中央巡逻椭圆和视觉参数。位置采用归一化湖面坐标，heading 单位为度。
- `src/adapters/vision.ts` 独立判断 ON、板面可见侧、视野、距离与圆形遮挡体，并输出 Tag ID、bearing、width 和距离。
- `src/adapters/mock.ts` 处理全向运动和 Kicker 伸出、接触、收回时序。触碰检查包含前向距离、横向误差和静止条件。
- `src/core/engine.ts` 负责状态机、识别锁定、接近与回程，保留代次保护与任务标识。
- `src/visual/water.ts` 负责 GPU 高度场及焦散通道；`waterOptics.ts` 负责俯视光学 Shader；`lakeBed.ts` 生成水底纹理；`ripple.ts` 负责统一事件与限幅；`lake.ts` 保留 Canvas 2D 前景、粒子及 GSAP 灯光。参考审计见 [visual_reference_audit.md](docs/visual_reference_audit.md)，代码改编版权见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。
- `src/views/` 绘制岸边集成装置、调试面板、竖直板投影预览及跨窗口同步。

默认 W_slow=70、W_stop=100、widthScale=7.6、FOV=100°、recognitionRange=0.85、扫描速度 32°/s、Kicker 中心到触点 reach=0.054。机器人半径 0.028，短柱从前端 0.028 伸到 0.054；停止中心距约 0.075 到板面，拨杆距岸边 0.025。width 根据平面距离计算，停止要求 bearing≤3°。这些均为演示参数，尚未标定实物。tagPose.z 仅表达竖直板高度，视觉传感器使用平面 FOV，尚未建模相机俯仰、畸变和真实投影。

装置可配置为三到四个，不要求位于边中心。修改 tagPose 或停靠偏移时，需要同时核对拨杆触碰范围与安全区。当前默认场景没有内部实体遮挡物，传感器提供 occluders 配置及遮挡回归测试。水草等显示内容不会被当成真实遮挡物。

## 验证

```powershell
npm test
npm run build
npm run test:e2e
```

E2E 使用本机 Chrome 的隔离上下文及 4173 端口生产预览，不读取个人资料。实际执行结果和范围见 VALIDATION.md。`npm run test:soak` 执行 10 分钟真实时间检查，报告写入 `artifacts/soak-report.json`。

视觉对照：[V3 1920×1080](evidence/visual-v4/v3-baseline-1920x1080.png) / [V4 1920×1080](evidence/visual-v4/full-scene-1920x1080.png)。V4 细节：[单波纹](evidence/visual-v4/single-ripple.png)、[交叉波纹](evidence/visual-v4/crossing-ripples.png)、[鱼破水](evidence/visual-v4/fish-breach.png)、[方向性尾流](evidence/visual-v4/robot-wake.png)、[停靠冲击](evidence/visual-v4/robot-stop.png)、[灯关](evidence/visual-v4/caustics-lights-off.png) / [灯开](evidence/visual-v4/caustics-light-on.png)。三尺寸完整场景见 `evidence/visual-v4/`。所有 V4 画面由本机 Chrome 运行实际场景生成，并已逐张查看。V3 与 V4 预览截图处于相同 1920×1080 视口；V4 的调试场景另列。

## 实物联调仍需验证

- 依据实际结构图确认各板面法线、Tag 高度、安装点、拨杆位置、机器人半径和 Kicker 行程。
- 标定相机 FOV、俯仰、Tag 尺寸与 width 距离关系，测试斜视、遮挡、日光和水面反射下的识别率。
- 验证实际全向运动、停靠误差、急停、安全边界和机械触碰容差。
- 实现真实开关反馈、断连与去抖、机器人命令确认，以及投影几何与通信时延校准。

本轮无 Arduino、VEX AIM 或投影仪连接。以真实开关 OFF 反馈确认任务完成仍是后续硬件接入要求。
