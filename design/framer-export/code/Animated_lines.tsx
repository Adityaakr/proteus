import { useEffect, useId, useRef, useState, type CSSProperties } from "react"
import { motion } from "framer-motion"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/**
 * ANIMATED BEAM LINES
 * Standalone animated beams — just the lines, no nodes/cards.
 *
 * Two modes:
 *  - Converge: all lines meet at one point (e.g. bottom-centre) and fan
 *    out to the opposite edge, S-curved. Beams sweep along each line.
 *  - Parallel: N evenly-spaced straight/curved lines.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 700
 * @framerIntrinsicHeight 400
 */

interface Props {
    mode: "converge" | "parallel"
    lineCount: number
    // Converge
    convergeX: number
    convergeY: number
    bend: number
    // Parallel
    orientation: "horizontal" | "vertical"
    curvature: number
    // Shared layout
    inset: number
    // Line styling
    pathColor: string
    pathWidth: number
    pathOpacity: number
    gradientStartColor: string
    gradientStopColor: string
    beamLength: number
    // Animation
    duration: number
    delay: number
    stagger: number
    repeatDelay: number
    speedVariation: number
    easing: string
    reverse: boolean
    style?: CSSProperties
}

interface BeamLine {
    d: string
    axis: "x" | "y"
    delay: number
    duration: number
}

export default function AnimatedBeamLines(props: Props) {
    const {
        mode = "converge",
        lineCount = 6,
        convergeX = 0.5,
        convergeY = 0.95,
        bend = 0.55,
        orientation = "horizontal",
        curvature = 0,
        inset = 0,
        pathColor = "#9ca3af",
        pathWidth = 2,
        pathOpacity = 0.2,
        gradientStartColor = "#ffaa40",
        gradientStopColor = "#9c40ff",
        beamLength = 22,
        duration = 8,
        delay = 0,
        stagger = 0.6,
        repeatDelay = 0,
        speedVariation = 0,
        easing = "linear",
        reverse = false,
        style,
    } = props

    const uid = useId()
    const containerRef = useRef<HTMLDivElement>(null)
    const [svg, setSvg] = useState({ width: 0, height: 0 })
    const [lines, setLines] = useState<BeamLine[]>([])

    const isThumbnail = RenderTarget.current() === RenderTarget.thumbnail

    const easeMap: Record<string, any> = {
        linear: "linear",
        easeOut: "easeOut",
        easeInOut: "easeInOut",
        expo: [0.16, 1, 0.3, 1],
    }
    const resolvedEase = easeMap[easing] ?? "linear"

    useEffect(() => {
        const measure = () => {
            const container = containerRef.current
            if (!container) return
            const rect = container.getBoundingClientRect()
            const w = rect.width
            const h = rect.height
            setSvg({ width: w, height: h })

            const count = Math.max(1, Math.round(lineCount))
            const next: BeamLine[] = []

            for (let i = 0; i < count; i++) {
                const t = count === 1 ? 0.5 : i / (count - 1)
                let d = ""
                let axis: "x" | "y" = "y"

                if (mode === "converge") {
                    // Convergence point (default bottom-centre)
                    const cx = w * convergeX
                    const cy = h * convergeY
                    // Fan-out endpoint along the top edge
                    const topX = inset + (w - 2 * inset) * t
                    const topY = 0
                    // Cubic S-curve: vertical at both ends, bends in the middle.
                    const c1y = cy * bend
                    const c2y = cy * bend
                    d = `M ${topX},${topY} C ${topX},${c1y} ${cx},${c2y} ${cx},${cy}`
                    axis = "y" // lines run top -> bottom, so sweep vertically
                } else if (orientation === "horizontal") {
                    const y = h * t
                    const x0 = inset
                    const x1 = w - inset
                    const midX = (x0 + x1) / 2
                    d =
                        curvature === 0
                            ? `M ${x0},${y} L ${x1},${y}`
                            : `M ${x0},${y} Q ${midX},${y - curvature} ${x1},${y}`
                    axis = "x"
                } else {
                    const x = w * t
                    const y0 = inset
                    const y1 = h - inset
                    const midY = (y0 + y1) / 2
                    d =
                        curvature === 0
                            ? `M ${x},${y0} L ${x},${y1}`
                            : `M ${x},${y0} Q ${x + curvature},${midY} ${x},${y1}`
                    axis = "y"
                }

                next.push({
                    d,
                    axis,
                    delay: delay + i * stagger,
                    duration:
                        speedVariation > 0
                            ? duration + ((i * 1.3) % (speedVariation * 2))
                            : duration,
                })
            }

            setLines(next)
        }

        measure()
        const raf = requestAnimationFrame(measure)
        const ro = new ResizeObserver(() => measure())
        if (containerRef.current) ro.observe(containerRef.current)
        window.addEventListener("resize", measure)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            window.removeEventListener("resize", measure)
        }
    }, [
        mode,
        lineCount,
        convergeX,
        convergeY,
        bend,
        orientation,
        curvature,
        inset,
        delay,
        stagger,
        duration,
        repeatDelay,
        speedVariation,
        easing,
        reverse,
    ])

    // Gradient sweep along one axis. L = streak length (% of that axis).
    const sweep = (axis: "x" | "y", rev: boolean, L: number) => {
        const lead = rev ? [`${100 - L}%`, `${-L}%`] : [`${L}%`, `${100 + L}%`]
        const base = rev ? ["100%", "0%"] : ["0%", "100%"]
        return axis === "x"
            ? { x1: lead, x2: base, y1: ["0%", "0%"], y2: ["0%", "0%"] }
            : { x1: ["0%", "0%"], x2: ["0%", "0%"], y1: lead, y2: base }
    }

    const containerStyle: CSSProperties = {
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
    }

    return (
        <div ref={containerRef} style={containerStyle}>
            <svg
                fill="none"
                width={svg.width}
                height={svg.height}
                viewBox={`0 0 ${svg.width} ${svg.height}`}
                xmlns="http://www.w3.org/2000/svg"
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    pointerEvents: "none",
                    transform: "translateZ(0)",
                }}
            >
                {lines.map((line, i) => {
                    const gradId = `line-${uid}-${i}`
                    const coords = sweep(line.axis, reverse, beamLength)
                    return (
                        <g key={i}>
                            {/* Static track */}
                            <path
                                d={line.d}
                                stroke={pathColor}
                                strokeWidth={pathWidth}
                                strokeOpacity={pathOpacity}
                                strokeLinecap="round"
                            />
                            {/* Animated beam */}
                            <path
                                d={line.d}
                                stroke={`url(#${gradId})`}
                                strokeWidth={pathWidth}
                                strokeOpacity={1}
                                strokeLinecap="round"
                            />
                            <defs>
                                <motion.linearGradient
                                    id={gradId}
                                    gradientUnits="userSpaceOnUse"
                                    initial={{
                                        x1: "0%",
                                        x2: "0%",
                                        y1: "0%",
                                        y2: "0%",
                                    }}
                                    animate={
                                        isThumbnail
                                            ? {
                                                  x1: "0%",
                                                  x2: "0%",
                                                  y1: "40%",
                                                  y2: "60%",
                                              }
                                            : {
                                                  x1: coords.x1,
                                                  x2: coords.x2,
                                                  y1: coords.y1,
                                                  y2: coords.y2,
                                              }
                                    }
                                    transition={
                                        isThumbnail
                                            ? { duration: 0 }
                                            : {
                                                  delay: line.delay,
                                                  duration: line.duration,
                                                  ease: resolvedEase,
                                                  repeat: Infinity,
                                                  repeatDelay: repeatDelay,
                                              }
                                    }
                                >
                                    <stop
                                        stopColor={gradientStartColor}
                                        stopOpacity="0"
                                    />
                                    <stop stopColor={gradientStartColor} />
                                    <stop
                                        offset="32.5%"
                                        stopColor={gradientStopColor}
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor={gradientStopColor}
                                        stopOpacity="0"
                                    />
                                </motion.linearGradient>
                            </defs>
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}

addPropertyControls(AnimatedBeamLines, {
    mode: {
        type: ControlType.Enum,
        title: "Mode",
        options: ["converge", "parallel"],
        optionTitles: ["Converge (fan)", "Parallel"],
        defaultValue: "converge",
    },
    lineCount: {
        type: ControlType.Number,
        title: "Lines",
        min: 1,
        max: 9,
        step: 1,
        defaultValue: 6,
    },

    // Converge-only
    convergeX: {
        type: ControlType.Number,
        title: "Meet X",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.5,
        description: "0 = left, 1 = right",
        hidden: (p: any) => p.mode !== "converge",
    },
    convergeY: {
        type: ControlType.Number,
        title: "Meet Y",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.95,
        description: "0 = top, 1 = bottom",
        hidden: (p: any) => p.mode !== "converge",
    },
    bend: {
        type: ControlType.Number,
        title: "Bend",
        min: 0.1,
        max: 0.95,
        step: 0.05,
        defaultValue: 0.55,
        description: "Where the curve turns inward",
        hidden: (p: any) => p.mode !== "converge",
    },

    // Parallel-only
    orientation: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["horizontal", "vertical"],
        optionTitles: ["Horizontal", "Vertical"],
        defaultValue: "horizontal",
        hidden: (p: any) => p.mode !== "parallel",
    },
    curvature: {
        type: ControlType.Number,
        title: "Curvature",
        min: -200,
        max: 200,
        defaultValue: 0,
        hidden: (p: any) => p.mode !== "parallel",
    },

    inset: {
        type: ControlType.Number,
        title: "Inset",
        min: 0,
        max: 300,
        defaultValue: 0,
        description: "Gap from the edges",
    },

    pathColor: {
        type: ControlType.Color,
        title: "Track",
        defaultValue: "#9ca3af",
    },
    pathWidth: {
        type: ControlType.Number,
        title: "Line Width",
        min: 1,
        max: 16,
        defaultValue: 2,
    },
    pathOpacity: {
        type: ControlType.Number,
        title: "Track Opacity",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.2,
    },
    gradientStartColor: {
        type: ControlType.Color,
        title: "Gradient A",
        defaultValue: "#ffaa40",
    },
    gradientStopColor: {
        type: ControlType.Color,
        title: "Gradient B",
        defaultValue: "#9c40ff",
    },
    beamLength: {
        type: ControlType.Number,
        title: "Beam Length",
        min: 5,
        max: 90,
        step: 1,
        defaultValue: 22,
        description: "Length of the glowing streak",
    },

    duration: {
        type: ControlType.Number,
        title: "Duration",
        min: 1,
        max: 30,
        step: 0.5,
        defaultValue: 8,
        description: "Higher = slower",
    },
    delay: {
        type: ControlType.Number,
        title: "Delay",
        min: 0,
        max: 6,
        step: 0.1,
        defaultValue: 0,
    },
    stagger: {
        type: ControlType.Number,
        title: "Stagger",
        min: 0,
        max: 3,
        step: 0.1,
        defaultValue: 0.6,
        description: "Offset between each line",
    },
    repeatDelay: {
        type: ControlType.Number,
        title: "Repeat Delay",
        min: 0,
        max: 10,
        step: 0.25,
        defaultValue: 0,
    },
    speedVariation: {
        type: ControlType.Number,
        title: "Speed Variation",
        min: 0,
        max: 3,
        step: 0.1,
        defaultValue: 0,
        description: "0 = uniform",
    },
    easing: {
        type: ControlType.Enum,
        title: "Easing",
        options: ["linear", "easeOut", "easeInOut", "expo"],
        optionTitles: [
            "Linear (steady)",
            "Ease Out",
            "Ease In-Out",
            "Expo (whoosh)",
        ],
        defaultValue: "linear",
    },
    reverse: {
        type: ControlType.Boolean,
        title: "Reverse",
        defaultValue: false,
    },
})
