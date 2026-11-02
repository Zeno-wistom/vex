# Third-party water simulation attribution

The V3 height-field ping-pong update and cosine drop profile in `src/visual/water.ts` are adapted from [jeantimex/threejs-water](https://github.com/jeantimex/threejs-water), specifically `Water.ts`, `WaveSimulation.frag`, and `WaterRipple.frag`. V4 also adapts the refraction and screen-space light-area focusing mechanism examined in its `WaterSurfacePass.ts`, `CausticsPass.ts`, `WaterAbove.frag`, and `Caustics.frag` into the original top-down `src/visual/waterOptics.ts` shader. The lake bed, 2D rendering integration, fish, and particles are original to this project. The other V4 sources were studied for algorithms and design principles without copying files or shaders; see [visual_reference_audit.md](docs/visual_reference_audit.md). No AGPL RippleAquarium source or unlicensed boids/ripple shaders were copied.

MIT License

Original work Copyright (c) 2011 Evan Wallace
Modified work Copyright (c) 2026 Yong Su

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
