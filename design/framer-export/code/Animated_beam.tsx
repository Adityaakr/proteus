import { useEffect, useId, useRef, useState, type CSSProperties } from "react"
import { motion } from "framer-motion"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/**
 * ANIMATED BEAM — hub & spoke
 * Self-contained Framer port of the Magic UI AnimatedBeam.
 * Renders its own nodes and draws animated gradient beams from each
 * side node into a central node. No external refs required.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 400
 */

interface NodeItem {
    image?: string
}

interface Props {
    // Layout
    padding: number
    gap: number
    nodeSize: number
    centerSize: number
    // Nodes
    centerImage?: string
    leftNodes: NodeItem[]
    rightNodes: NodeItem[]
    // Node styling
    nodeBackground: string
    nodeBorderColor: string
    nodeBorderWidth: number
    nodeRadius: number
    // Beam styling
    pathColor: string
    pathWidth: number
    pathOpacity: number
    gradientStartColor: string
    gradientStopColor: string
    curvature: number
    endYOffset: number
    // Animation
    duration: number
    delay: number
    stagger: number
    repeatDelay: number
    speedVariation: number
    easing: string
    reverseFlow: boolean
    style?: CSSProperties
}

interface Beam {
    d: string
    reverse: boolean
    delay: number
    duration: number
}

export default function AnimatedBeam(props: Props) {
    const {
        padding = 40,
        gap = 24,
        nodeSize = 48,
        centerSize = 64,
        centerImage,
        leftNodes = [],
        rightNodes = [],
        nodeBackground = "#ffffff",
        nodeBorderColor = "#e5e7eb",
        nodeBorderWidth = 2,
        nodeRadius = 999,
        pathColor = "#9ca3af",
        pathWidth = 2,
        pathOpacity = 0.2,
        gradientStartColor = "#ffaa40",
        gradientStopColor = "#9c40ff",
        curvature = 75,
        endYOffset = 10,
        duration = 8,
        delay = 0,
        stagger = 0.4,
        repeatDelay = 0,
        speedVariation = 0.5,
        easing = "linear",
        reverseFlow = false,
        style,
    } = props

    const uid = useId()
    const containerRef = useRef<HTMLDivElement>(null)
    const centerRef = useRef<HTMLDivElement>(null)
    const leftRefs = useRef<(HTMLDivElement | null)[]>([])
    const rightRefs = useRef<(HTMLDivElement | null)[]>([])

    const [svg, setSvg] = useState({ width: 0, height: 0 })
    const [beams, setBeams] = useState<Beam[]>([])

    // On the static export thumbnail we freeze the animation to a mid-flow frame.
    const isThumbnail = RenderTarget.current() === RenderTarget.thumbnail

    // Resolve the easing choice into a framer-motion value.
    // "expo" is the original Magic UI whoosh (front-loaded, feels fast).
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
            const center = centerRef.current
            if (!container || !center) return

            const cRect = container.getBoundingClientRect()
            setSvg({ width: cRect.width, height: cRect.height })
            const half = cRect.height / 2 || 1

            const centerRect = center.getBoundingClientRect()
            const cx = centerRect.left - cRect.left + centerRect.width / 2
            const cy = centerRect.top - cRect.top + centerRect.height / 2

            const next: Beam[] = []

            const build = (
                el: HTMLDivElement | null,
                isRight: boolean,
                index: number
            ) => {
                if (!el) return
                const r = el.getBoundingClientRect()
                const sx = r.left - cRect.left + r.width / 2
                const sy = r.top - cRect.top + r.height / 2

                const dy = sy - cy
                const sign = dy === 0 ? 0 : dy < 0 ? -1 : 1

                // Control point pulls the arc back toward the centre line,
                // scaled by how far the node sits from centre (mirrors demo).
                const curveApplied = curvature * (dy / half)
                const controlY = sy - curveApplied
                const midX = (sx + cx) / 2
                const endY = cy + sign * endYOffset

                const d = `M ${sx},${sy} Q ${midX},${controlY} ${cx},${endY}`

                // Left nodes flow into centre; right nodes are reversed so
                // both sides visually converge. reverseFlow flips everything.
                const baseReverse = isRight
                next.push({
                    d,
                    reverse: reverseFlow ? !baseReverse : baseReverse,
                    delay: delay + index * stagger,
                    duration:
                        speedVariation > 0
                            ? duration + ((index * 1.3) % (speedVariation * 2))
                            : duration,
                })
            }

            leftRefs.current.forEach((el, i) => build(el, false, i))
            rightRefs.current.forEach((el, i) =>
                build(el, true, leftRefs.current.length + i)
            )

            setBeams(next)
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
        leftNodes.length,
        rightNodes.length,
        nodeSize,
        centerSize,
        padding,
        gap,
        curvature,
        endYOffset,
        delay,
        stagger,
        duration,
        repeatDelay,
        speedVariation,
        easing,
        reverseFlow,
    ])

    // ---- styles -------------------------------------------------------------
    const containerStyle: CSSProperties = {
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        overflow: "hidden",
        padding,
        boxSizing: "border-box",
        ...style,
    }

    const columnStyle: CSSProperties = {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-around",
        alignItems: "center",
        gap,
        height: "100%",
        zIndex: 1,
    }

    const nodeStyle = (size: number): CSSProperties => ({
        width: size,
        height: size,
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: nodeRadius,
        background: nodeBackground,
        border: `${nodeBorderWidth}px solid ${nodeBorderColor}`,
        boxShadow: "0 0 20px -12px rgba(0,0,0,0.8)",
        overflow: "hidden",
        boxSizing: "border-box",
    })

    const imgStyle: CSSProperties = {
        width: "70%",
        height: "70%",
        objectFit: "contain",
    }

    const Node = (item: NodeItem, size: number, dotColor: string) => {
        if (item?.image)
            return (
                <img
                    src={item.image}
                    alt=""
                    style={imgStyle}
                    draggable={false}
                />
            )
        // Fallback marker when no image is set
        return (
            <div
                style={{
                    width: "35%",
                    height: "35%",
                    borderRadius: 999,
                    background: dotColor,
                    opacity: 0.85,
                }}
            />
        )
    }

    const gradientCoords = (reverse: boolean) =>
        reverse
            ? {
                  x1: ["90%", "-10%"],
                  x2: ["100%", "0%"],
                  y1: ["0%", "0%"],
                  y2: ["0%", "0%"],
              }
            : {
                  x1: ["10%", "110%"],
                  x2: ["0%", "100%"],
                  y1: ["0%", "0%"],
                  y2: ["0%", "0%"],
              }

    return (
        <div ref={containerRef} style={containerStyle}>
            {/* Left column */}
            <div style={columnStyle}>
                {leftNodes.map((item, i) => (
                    <div
                        key={`l-${i}`}
                        ref={(el) => (leftRefs.current[i] = el)}
                        style={nodeStyle(nodeSize)}
                    >
                        {Node(item, nodeSize, gradientStartColor)}
                    </div>
                ))}
            </div>

            {/* Center node */}
            <div style={{ ...columnStyle, justifyContent: "center" }}>
                <div ref={centerRef} style={nodeStyle(centerSize)}>
                    {Node(
                        { image: centerImage },
                        centerSize,
                        gradientStopColor
                    )}
                </div>
            </div>

            {/* Right column */}
            <div style={columnStyle}>
                {rightNodes.map((item, i) => (
                    <div
                        key={`r-${i}`}
                        ref={(el) => (rightRefs.current[i] = el)}
                        style={nodeStyle(nodeSize)}
                    >
                        {Node(item, nodeSize, gradientStartColor)}
                    </div>
                ))}
            </div>

            {/* Beams */}
            <svg
                fill="none"
                width={svg.width}
                height={svg.height}
                viewBox={`0 0 ${svg.width} ${svg.height}`}
                xmlns="http://www.w3.org/2000/svg"
                style={{
                    pointerEvents: "none",
                    position: "absolute",
                    left: 0,
                    top: 0,
                    transform: "translateZ(0)",
                }}
            >
                {beams.map((beam, i) => {
                    const gradId = `beam-${uid}-${i}`
                    const coords = gradientCoords(beam.reverse)
                    return (
                        <g key={i}>
                            {/* Static track */}
                            <path
                                d={beam.d}
                                stroke={pathColor}
                                strokeWidth={pathWidth}
                                strokeOpacity={pathOpacity}
                                strokeLinecap="round"
                            />
                            {/* Animated gradient beam */}
                            <path
                                d={beam.d}
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
                                                  x1: "40%",
                                                  x2: "50%",
                                                  y1: "0%",
                                                  y2: "0%",
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
                                                  delay: beam.delay,
                                                  duration: beam.duration,
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

const nodeControl = {
    type: ControlType.Object,
    controls: {
        image: { type: ControlType.Image, title: "Image" },
    },
}

addPropertyControls(AnimatedBeam, {
    centerImage: { type: ControlType.Image, title: "Center" },
    leftNodes: {
        type: ControlType.Array,
        title: "Left Nodes",
        control: nodeControl,
        defaultValue: [{}, {}, {}],
        maxCount: 6,
    },
    rightNodes: {
        type: ControlType.Array,
        title: "Right Nodes",
        control: nodeControl,
        defaultValue: [{}, {}, {}],
        maxCount: 6,
    },

    nodeSize: {
        type: ControlType.Number,
        title: "Node Size",
        min: 24,
        max: 160,
        defaultValue: 48,
    },
    centerSize: {
        type: ControlType.Number,
        title: "Center Size",
        min: 24,
        max: 200,
        defaultValue: 64,
    },
    padding: {
        type: ControlType.Number,
        title: "Padding",
        min: 0,
        max: 200,
        defaultValue: 40,
    },
    gap: {
        type: ControlType.Number,
        title: "Node Gap",
        min: 0,
        max: 120,
        defaultValue: 24,
    },

    nodeBackground: {
        type: ControlType.Color,
        title: "Node BG",
        defaultValue: "#ffffff",
    },
    nodeBorderColor: {
        type: ControlType.Color,
        title: "Node Border",
        defaultValue: "#e5e7eb",
    },
    nodeBorderWidth: {
        type: ControlType.Number,
        title: "Border W",
        min: 0,
        max: 8,
        defaultValue: 2,
    },
    nodeRadius: {
        type: ControlType.Number,
        title: "Node Radius",
        min: 0,
        max: 999,
        defaultValue: 999,
    },

    pathColor: {
        type: ControlType.Color,
        title: "Track",
        defaultValue: "#9ca3af",
    },
    pathWidth: {
        type: ControlType.Number,
        title: "Beam Width",
        min: 1,
        max: 12,
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

    curvature: {
        type: ControlType.Number,
        title: "Curvature",
        min: 0,
        max: 200,
        defaultValue: 75,
    },
    endYOffset: {
        type: ControlType.Number,
        title: "End Offset",
        min: -40,
        max: 40,
        defaultValue: 10,
    },

    duration: {
        type: ControlType.Number,
        title: "Duration",
        min: 1,
        max: 30,
        step: 0.5,
        defaultValue: 8,
        description: "Higher = slower sweep",
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
        max: 2,
        step: 0.1,
        defaultValue: 0.4,
    },
    repeatDelay: {
        type: ControlType.Number,
        title: "Repeat Delay",
        min: 0,
        max: 10,
        step: 0.25,
        defaultValue: 0,
        description: "Pause between sweeps",
    },
    speedVariation: {
        type: ControlType.Number,
        title: "Speed Variation",
        min: 0,
        max: 3,
        step: 0.1,
        defaultValue: 0.5,
        description: "0 = uniform timing",
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
        description: "Linear makes Duration control real speed",
    },
    reverseFlow: {
        type: ControlType.Boolean,
        title: "Reverse Flow",
        defaultValue: false,
    },
})
