import * as React from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/**
 * PixelDitherHero v3 — Ferndesk-style living pixel effect.
 *
 * The effect combines four behaviours in one field:
 *  • WAVES    — a directional gradient sweeps through, band edges dissolve
 *  • SHIMMER  — fractal noise flows underneath
 *  • SWEEP    — the gradient itself travels at an angle over time
 *  • BLINKING — per-pixel random dither thresholds + stepped low-FPS time,
 *               so pixels snap on/off instead of fading
 *
 * Modes: Noise field (hero effect) or dithered uploaded Image.
 */

// ---------- Bayer 8x8 ordered matrix (0..1) ----------
const BAYER8 = (() => {
    const m = [
        [0, 32, 8, 40, 2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44, 4, 36, 14, 46, 6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [3, 35, 11, 43, 1, 33, 9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47, 7, 39, 13, 45, 5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21],
    ]
    return m.map((r) => r.map((v) => (v + 0.5) / 64))
})()

// ---------- per-pixel hash (white-noise threshold) ----------
function hash2(x: number, y: number, s: number) {
    let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0
    h = (h ^ (h >>> 13)) | 0
    h = Math.imul(h, 1274126177)
    h = (h ^ (h >>> 16)) >>> 0
    return h / 4294967296
}

// ---------- robust color parsing (hex / rgb / rgba / css vars) ----------
function parseColor(input: string): [number, number, number, number] {
    if (!input) return [0, 0, 0, 1]
    let str = String(input).trim()
    if (str.startsWith("var(") || !/^(#|rgb|hsl)/i.test(str)) {
        if (typeof document !== "undefined") {
            const el = document.createElement("div")
            el.style.color = str
            document.body.appendChild(el)
            str = getComputedStyle(el).color || str
            document.body.removeChild(el)
        }
    }
    if (str.startsWith("#")) {
        let h = str.slice(1)
        if (h.length === 3 || h.length === 4)
            h = h
                .split("")
                .map((c) => c + c)
                .join("")
        const n = parseInt(h.slice(0, 6), 16)
        const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
    }
    const m = str.match(/rgba?\(([^)]+)\)/i)
    if (m) {
        const p = m[1]
            .split(/[\s,\/]+/)
            .filter(Boolean)
            .map(parseFloat)
        return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] ?? 1]
    }
    if (typeof document !== "undefined") {
        const c = document.createElement("canvas")
        c.width = c.height = 1
        const ctx = c.getContext("2d")
        if (ctx) {
            ctx.fillStyle = str
            ctx.fillRect(0, 0, 1, 1)
            const d = ctx.getImageData(0, 0, 1, 1).data
            return [d[0], d[1], d[2], d[3] / 255]
        }
    }
    return [0, 0, 0, 1]
}

// ---------- tiny 3D value-noise ----------
function makeNoise(seed: number) {
    const perm = new Uint8Array(512)
    let s = seed >>> 0
    const rand = () => {
        s = (s * 1664525 + 1013904223) >>> 0
        return s / 4294967296
    }
    const p = Array.from({ length: 256 }, (_, i) => i)
    for (let i = 255; i > 0; i--) {
        const j = (rand() * (i + 1)) | 0
        ;[p[i], p[j]] = [p[j], p[i]]
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
    const fade = (t: number) => t * t * (3 - 2 * t)
    return (x: number, y: number, z: number) => {
        const xi = Math.floor(x) & 255,
            yi = Math.floor(y) & 255,
            zi = Math.floor(z) & 255
        const xf = x - Math.floor(x),
            yf = y - Math.floor(y),
            zf = z - Math.floor(z)
        const u = fade(xf),
            v = fade(yf),
            w = fade(zf)
        const h = (a: number, b: number, c: number) =>
            perm[(perm[(perm[a & 255] + b) & 255] + c) & 255] / 255
        const L = (a: number, b: number, t: number) => a + (b - a) * t
        return L(
            L(
                L(h(xi, yi, zi), h(xi + 1, yi, zi), u),
                L(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u),
                v
            ),
            L(
                L(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u),
                L(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u),
                v
            ),
            w
        )
    }
}

export default function PixelDitherHero(props) {
    const {
        mode = "noise",
        image,
        useImageColors = false,
        pixelSize = 8,
        speed = 1,
        fps = 12,
        sweepAngle = 135,
        sweepStrength = 0.7,
        noiseScale = 1.4,
        noiseStrength = 0.6,
        sparkle = 0.25,
        ditherMix = 0.7,
        levels = 4,
        contrast = 1.3,
        colorA = "#0E3B2E",
        colorB = "#2E7D5B",
        colorC = "#A8E6C1",
        background = "rgba(0,0,0,0)",
        radialFade = true,
        fadeStrength = 0.9,
        seed = 7,
        style,
    } = props

    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const imageSrc =
        typeof image === "string" ? image : image?.src || image?.url || null

    React.useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const noise = makeNoise(seed)
        const cA = parseColor(colorA)
        const cB = parseColor(colorB)
        const cC = parseColor(colorC)
        const ramp = (f: number): [number, number, number] => {
            let c0, c1, t
            if (f < 0.5) {
                c0 = cA
                c1 = cB
                t = f * 2
            } else {
                c0 = cB
                c1 = cC
                t = (f - 0.5) * 2
            }
            return [
                c0[0] + (c1[0] - c0[0]) * t,
                c0[1] + (c1[1] - c0[1]) * t,
                c0[2] + (c1[2] - c0[2]) * t,
            ]
        }

        const rad = (sweepAngle * Math.PI) / 180
        const dirX = Math.cos(rad)
        const dirY = Math.sin(rad)

        let raf = 0
        let running = true
        let gw = 0,
            gh = 0
        let img: ImageData | null = null
        let srcPixels: Uint8ClampedArray | null = null
        let lastFrame = -1

        const sampleImage = (el: HTMLImageElement) => {
            if (!gw || !gh) return
            const off = document.createElement("canvas")
            off.width = gw
            off.height = gh
            const octx = off.getContext("2d")
            if (!octx) return
            const ir = el.naturalWidth / el.naturalHeight
            const gr = gw / gh
            let sw = el.naturalWidth,
                sh = el.naturalHeight,
                sx = 0,
                sy = 0
            if (ir > gr) {
                sw = el.naturalHeight * gr
                sx = (el.naturalWidth - sw) / 2
            } else {
                sh = el.naturalWidth / gr
                sy = (el.naturalHeight - sh) / 2
            }
            octx.drawImage(el, sx, sy, sw, sh, 0, 0, gw, gh)
            srcPixels = octx.getImageData(0, 0, gw, gh).data
        }

        let imgEl: HTMLImageElement | null = null
        if (mode === "image" && imageSrc) {
            imgEl = new Image()
            imgEl.crossOrigin = "anonymous"
            imgEl.onload = () => {
                if (imgEl) sampleImage(imgEl)
                if (isCanvas) draw(0)
            }
            imgEl.src = imageSrc
        }

        const resize = () => {
            const rect = canvas.parentElement?.getBoundingClientRect()
            if (!rect) return
            gw = Math.max(1, Math.ceil(rect.width / pixelSize))
            gh = Math.max(1, Math.ceil(rect.height / pixelSize))
            canvas.width = gw
            canvas.height = gh
            canvas.style.width = "100%"
            canvas.style.height = "100%"
            img = ctx.createImageData(gw, gh)
            if (imgEl?.complete && imgEl.naturalWidth) sampleImage(imgEl)
            lastFrame = -1
        }
        resize()
        const ro = new ResizeObserver(resize)
        if (canvas.parentElement) ro.observe(canvas.parentElement)

        // frameIdx = quantized time step → gives snap/blink instead of fade
        const draw = (frameIdx: number) => {
            if (!img) return
            const data = img.data
            const time = frameIdx / Math.max(1, fps) // seconds-equivalent
            const cx = gw / 2,
                cy = gh / 2
            const maxR = Math.sqrt(cx * cx + cy * cy)
            const diag = Math.max(1, gw * Math.abs(dirX) + gh * Math.abs(dirY))
            const imageMode = mode === "image" && srcPixels

            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < gw; x++) {
                    const i = (y * gw + x) * 4

                    // ---- field value 0..1 ----
                    let v: number
                    let alpha = 255

                    if (imageMode) {
                        const r = srcPixels![i],
                            g = srcPixels![i + 1],
                            b = srcPixels![i + 2],
                            a = srcPixels![i + 3]
                        if (a < 10) {
                            data[i + 3] = 0
                            continue
                        }
                        if (useImageColors) {
                            // per-channel quantize with mixed dither
                            const to = ditherThreshold(x, y, frameIdx)
                            const q = (c: number) => {
                                const f = c / 255
                                const lv = Math.floor(f * levels + (to - 0.5))
                                return (
                                    (Math.min(levels - 1, Math.max(0, lv)) /
                                        (levels - 1)) *
                                    255
                                )
                            }
                            data[i] = q(r)
                            data[i + 1] = q(g)
                            data[i + 2] = q(b)
                            data[i + 3] = a
                            continue
                        }
                        v = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
                        v = (v - 0.5) * contrast + 0.5
                    } else {
                        // 1) travelling gradient sweep (waves + sweep)
                        const proj = (x * dirX + y * dirY) / diag
                        const sweep =
                            0.5 +
                            0.5 *
                                Math.sin(
                                    (proj - time * 0.25 * speed) * Math.PI * 2
                                )

                        // 2) flowing fractal noise (shimmer)
                        const nx = (x / gw) * noiseScale * 3
                        const ny = (y / gh) * noiseScale * 3
                        const n =
                            noise(nx, ny, time * 0.3 * speed) * 0.65 +
                            noise(nx * 2.2, ny * 2.2, time * 0.5 * speed) * 0.35

                        v = sweep * sweepStrength + n * noiseStrength
                        v /= Math.max(0.001, sweepStrength + noiseStrength)
                        v = (v - 0.5) * contrast + 0.5

                        // 3) radial falloff → concentrates the effect
                        if (radialFade) {
                            const dx = x - cx,
                                dy = y - cy
                            const d = Math.sqrt(dx * dx + dy * dy) / maxR
                            v -= d * d * fadeStrength
                        }
                    }
                    v = Math.min(1, Math.max(0, v))

                    // ---- dither: mixed ordered + random, temporally jittered ----
                    const t0 = ditherThreshold(x, y, frameIdx)
                    const q = Math.floor(v * levels + (t0 - 0.5))
                    const level = Math.min(levels - 1, Math.max(0, q))

                    if (level <= 0) {
                        data[i + 3] = 0
                    } else {
                        const c = ramp(level / (levels - 1))
                        data[i] = c[0]
                        data[i + 1] = c[1]
                        data[i + 2] = c[2]
                        data[i + 3] = alpha
                    }
                }
            }
            ctx.putImageData(img, 0, 0)
        }

        // threshold = blend(Bayer ordered, per-pixel random), plus per-frame
        // jitter scaled by `sparkle` → this is what makes pixels BLINK
        const ditherThreshold = (x: number, y: number, frameIdx: number) => {
            const ordered = BAYER8[y & 7][x & 7]
            const rnd = hash2(x, y, seed)
            let t = ordered * (1 - ditherMix) + rnd * ditherMix
            if (sparkle > 0) {
                const jitter = hash2(x, y, seed + frameIdx * 7919) - 0.5
                t += jitter * sparkle
            }
            return Math.min(0.999, Math.max(0.001, t))
        }

        // stepped clock: only redraw when the frame index changes
        const loop = (t: number) => {
            if (!running) return
            const frameIdx = Math.floor(
                (t / 1000) * fps * Math.max(0.001, speed)
            )
            if (frameIdx !== lastFrame) {
                lastFrame = frameIdx
                draw(frameIdx)
            }
            raf = requestAnimationFrame(loop)
        }

        if (isCanvas)
            draw(3) // static frame on Framer canvas
        else raf = requestAnimationFrame(loop)

        return () => {
            running = false
            cancelAnimationFrame(raf)
            ro.disconnect()
        }
    }, [
        mode,
        imageSrc,
        useImageColors,
        pixelSize,
        speed,
        fps,
        sweepAngle,
        sweepStrength,
        noiseScale,
        noiseStrength,
        sparkle,
        ditherMix,
        levels,
        contrast,
        colorA,
        colorB,
        colorC,
        radialFade,
        fadeStrength,
        seed,
        isCanvas,
    ])

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
                background,
                ...style,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    imageRendering: "pixelated",
                }}
            />
        </div>
    )
}

addPropertyControls(PixelDitherHero, {
    mode: {
        type: ControlType.Enum,
        title: "Mode",
        options: ["noise", "image"],
        optionTitles: ["Effect", "Image"],
        displaySegmentedControl: true,
        defaultValue: "noise",
    },
    image: {
        type: ControlType.ResponsiveImage,
        title: "Image",
        hidden: (p) => p.mode !== "image",
    },
    useImageColors: {
        type: ControlType.Boolean,
        title: "Image Colors",
        enabledTitle: "Original",
        disabledTitle: "Palette",
        defaultValue: false,
        hidden: (p) => p.mode !== "image",
    },
    pixelSize: {
        type: ControlType.Number,
        title: "Pixel Size",
        min: 2,
        max: 32,
        step: 1,
        defaultValue: 8,
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 3,
        step: 0.05,
        defaultValue: 1,
    },
    fps: {
        type: ControlType.Number,
        title: "Step FPS",
        min: 2,
        max: 60,
        step: 1,
        defaultValue: 12,
        description: "Lower = choppier retro blinking. Higher = smoother.",
    },
    sweepAngle: {
        type: ControlType.Number,
        title: "Sweep Angle",
        min: 0,
        max: 360,
        step: 5,
        defaultValue: 135,
        unit: "°",
        hidden: (p) => p.mode !== "noise",
    },
    sweepStrength: {
        type: ControlType.Number,
        title: "Sweep",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.7,
        hidden: (p) => p.mode !== "noise",
    },
    noiseScale: {
        type: ControlType.Number,
        title: "Noise Scale",
        min: 0.3,
        max: 5,
        step: 0.1,
        defaultValue: 1.4,
        hidden: (p) => p.mode !== "noise",
    },
    noiseStrength: {
        type: ControlType.Number,
        title: "Noise",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.6,
        hidden: (p) => p.mode !== "noise",
    },
    sparkle: {
        type: ControlType.Number,
        title: "Sparkle",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.25,
        description: "Per-frame threshold jitter — makes pixels blink.",
    },
    ditherMix: {
        type: ControlType.Number,
        title: "Dither Mix",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.7,
        description: "0 = ordered crosshatch, 1 = random grain.",
    },
    levels: {
        type: ControlType.Number,
        title: "Color Levels",
        min: 2,
        max: 8,
        step: 1,
        defaultValue: 4,
    },
    contrast: {
        type: ControlType.Number,
        title: "Contrast",
        min: 0.5,
        max: 3,
        step: 0.1,
        defaultValue: 1.3,
    },
    colorA: { type: ControlType.Color, title: "Dark", defaultValue: "#0E3B2E" },
    colorB: { type: ControlType.Color, title: "Mid", defaultValue: "#2E7D5B" },
    colorC: {
        type: ControlType.Color,
        title: "Light",
        defaultValue: "#A8E6C1",
    },
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "rgba(0,0,0,0)",
    },
    radialFade: {
        type: ControlType.Boolean,
        title: "Radial Fade",
        defaultValue: true,
        hidden: (p) => p.mode !== "noise",
    },
    fadeStrength: {
        type: ControlType.Number,
        title: "Fade Strength",
        min: 0,
        max: 2.5,
        step: 0.05,
        defaultValue: 0.9,
        hidden: (p) => p.mode !== "noise" || !p.radialFade,
    },
    seed: {
        type: ControlType.Number,
        title: "Seed",
        min: 1,
        max: 999,
        step: 1,
        defaultValue: 7,
    },
})
