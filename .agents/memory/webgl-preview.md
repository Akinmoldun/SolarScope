---
name: WebGL preview limitation
description: The managed screenshot preview may lack a hardware WebGL context even when the Three.js app is valid.
---

The managed preview browser can report `BindToCurrentSequence failed` while creating a WebGL context. Treat this as an environment limitation, not proof that the scene code is invalid; the app should feature-detect WebGL and show an honest fallback instead of mounting Canvas blindly.

**Why:** The SolarScope scene is a real WebGL renderer, but preview infrastructure may run without GPU support. A graceful fallback keeps the surrounding simulator usable and prevents the runtime error overlay.

**How to apply:** Always verify Three.js scenes in a hardware-accelerated browser before presenting them as visually verified. Keep the fallback message explicit and do not replace the WebGL scene with a fake CSS illustration. In this workspace, the bundled Chromium also lacks a usable X11/GLX hardware adapter; ANGLE with SwiftShader can provide a real WebGL context for interaction and screenshot checks, but it is not hardware-rendered evidence.