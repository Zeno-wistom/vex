# V4 视觉参考与复用审计

2026-11-02 从五个上游仓库的实际源码读取，不以 README 代替实现审查。V4 保留 V3 的俯视 WebGL2 高度场；下表区分代码改编、算法机制参考和明确舍弃的部分。

| 上游与所读版本 | 实际阅读文件 | 本项目对应实现 | 复用边界与许可 |
| --- | --- | --- | --- |
| [Clearwater `4bc8261`](https://github.com/Aureliengmz/clearwater/tree/4bc826134321043a25df3c2b6fed16fb7b9241e8) | `index.html` 的 Ocean spectrum、Interactive ripples、Caustics、Main water shader、Post processing | `waterOptics.ts` 将缓慢多尺度起伏、折射水底、流动焦散与日光高光组成俯视浅水层；`water.ts` 继续使用单一局部波动场 | 机制参考；没有复制 FFT、光线追踪、后处理或整页源码。上游 [MIT](https://github.com/Aureliengmz/clearwater/blob/4bc826134321043a25df3c2b6fed16fb7b9241e8/LICENSE)，Copyright (c) 2026 Lumaris。FFT 16 次蝶形 pass 对本项目小湖面没有相称收益，故未引入。 |
| [threejs-water `f35a700`](https://github.com/jeantimex/threejs-water/tree/f35a700a16fe386beac997806ed4471018c93ef7) | `src/rendering/WaterSurfacePass.ts`、`CausticsPass.ts`、`src/shaders/WaterAbove.frag`、`Caustics.frag`，及 V3 的 `WaveSimulation.frag`、`WaterRipple.frag` | `water.ts` 的双 FBO 高度/速度更新与余弦扰动沿用已署名的 V3 改编；V4 的 `waterOptics.ts` 使用折射后采样水底、以屏幕空间导数估计光线面积收缩的焦散机制 | 代码改编与机制改编。保留 Evan Wallace、Yong Su 的版权及完整 [MIT](../THIRD_PARTY_LICENSES.md)。未复制池壁、天空盒、球/立方体射线求交或完整水池渲染 pass。 |
| [WaterThreeJS `4f85f4a`](https://github.com/achrefelouafi/WaterThreeJS/tree/4f85f4a557da80a1dd24b9243869177f30c604c7) | `src/Ocean.js`、`FloatingBodies.js`、`Particles.js`、`src/shaders/common.js` | `ripple.ts` 的后向 capsule 扰动和 `lake.ts` 的少量随尾流衰减的接触泡沫、入水抛射水滴 | 算法与表现参考，未复制上游 Shader/文件；无海面、船、岛屿、天空和大型粒子场。上游 [MIT](https://github.com/achrefelouafi/WaterThreeJS/blob/4f85f4a557da80a1dd24b9243869177f30c604c7/LICENSE)，Copyright (c) 2026 mohamedachrefelouafi。 |
| [Aquarium `2a6e16c`](https://github.com/jamisonhill/aquarium/tree/2a6e16ce5df82b858183c02624d2ac5e605faec5) | `src/engine/FishFactory.ts`、`FishSystem.ts`、`CurrentField.ts`、`shaders.ts` | `fish.ts` 累积尾鳍相位、速度调频、平滑转向、上浮/破水/下潜深度曲线；`lake.ts` 的 Canvas 身体弯曲、胸鳍与水草同向摆动 | 行为与运动原则参考，未复制 Three.js 鱼几何、Shader 或 React 水族箱。上游在 [LICENSES.md](https://github.com/jamisonhill/aquarium/blob/2a6e16ce5df82b858183c02624d2ac5e605faec5/LICENSES.md) 声明代码 MIT；未找到独立 LICENSE 正文，因此只参考原理。 |
| [Liquid Ripple `c5f3ba0`](https://github.com/AsimRauf/liquid-ripple/tree/c5f3ba09765a8f659cf427509360fc88b65b28f5) | `src/shaders.ts` | `waterOptics.ts` 的微弱背景多尺度起伏、法线折射和方向性高光 | 辅助视觉原理参考；没有复制其解析圆环数组或第二套波动模拟。上游 [MIT](https://github.com/AsimRauf/liquid-ripple/blob/c5f3ba09765a8f659cf427509360fc88b65b28f5/LICENSE)，Copyright (c) 2026 Axistify。 |

`lakeBed.ts` 的水底纹理、V4 的水面与焦散 Shader、Canvas 鱼和粒子绘制均为本项目新写代码。焦散采用移动的不规则细胞脊线与高度场折射面积变化相乘，是俯视视觉近似；不声称进行了 Clearwater 的 FFT 海洋模拟或完整物理光线追踪。生产路径不做 GPU→CPU 逐帧回读，只有测试探针会读一个像素。
