import { useEffect, useId, useRef, useState, type CSSProperties } from "react"
import { motion } from "framer-motion"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/**
 * ANIMATED BEAM LINES
 * Converging fan / parallel animated beams with optional labelled
 * cards at each line's fan-out end. Flippable on both axes.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 700
 * @framerIntrinsicHeight 440
 */

interface CardItem {
    text?: string
    icon?: string
}

interface Props {
    mode: "converge" | "parallel"
    lineCount: number
    flipVertical: boolean
    flipHorizontal: boolean
    // Converge
    convergeX: number
    convergeY: number
    bend: number
    // Meet icon (at convergence point)
    meetIcon?: string
    meetIconSize: number
    meetIconBackground: string
    meetIconBorderColor: string
    meetIconBorderWidth: number
    meetIconRadius: number
    meetIconPadding: number
    // Parallel
    orientation: "horizontal" | "vertical"
    curvature: number
    // Shared layout
    inset: number
    // Cards
    showCards: boolean
    cards: CardItem[]
    cardBackground: string
    cardTextColor: string
    cardBorderColor: string
    cardBorderWidth: number
    cardRadius: number
    cardPaddingX: number
    cardPaddingY: number
    cardIconSize: number
    fontSize: number
    fontWeight: number
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
    // Fan-out endpoint (where a card attaches)
    endX: number
    endY: number
    delay: number
    duration: number
}

export default function AnimatedBeamLines(props: Props) {
    const {
        mode = "converge",
        lineCount = 6,
        flipVertical = false,
        flipHorizontal = false,
        convergeX = 0.5,
        convergeY = 0.95,
        bend = 0.55,
        meetIcon,
        meetIconSize = 48,
        meetIconBackground = "#18181b",
        meetIconBorderColor = "#3f3f46",
        meetIconBorderWidth = 1,
        meetIconRadius = 999,
        meetIconPadding = 10,
        orientation = "horizontal",
        curvature = 0,
        inset = 0,
        showCards = true,
        cards = [],
        cardBackground = "#18181b",
        cardTextColor = "#fafafa",
        cardBorderColor = "#3f3f46",
        cardBorderWidth = 1,
        cardRadius = 10,
        cardPaddingX = 14,
        cardPaddingY = 8,
        cardIconSize = 18,
        fontSize = 13,
        fontWeight = 500,
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
    const [meetPoint, setMeetPoint] = useState({ x: 0, y: 0 })

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

            // Geometry-level flips: map a point through the mirrors.
            const fx = (x: number) => (flipHorizontal ? w - x : x)
            const fy = (y: number) => (flipVertical ? h - y : y)

            for (let i = 0; i < count; i++) {
                const t = count === 1 ? 0.5 : i / (count - 1)
                let d = ""
                let axis: "x" | "y" = "y"
                let endX = 0
                let endY = 0

                if (mode === "converge") {
                    // Convergence point + fan-out endpoints in base
                    // (unflipped) space, then mirrored.
                    const cx = fx(w * convergeX)
                    const cy = fy(h * convergeY)
                    const topX = fx(inset + (w - 2 * inset) * t)
                    const topY = fy(0)
                    const c1y = fy(h * convergeY * bend)
                    const c2y = c1y
                    d = `M ${topX},${topY} C ${topX},${c1y} ${cx},${c2y} ${cx},${cy}`
                    axis = "y"
                    endX = topX
                    endY = topY
                } else if (orientation === "horizontal") {
                    const y = fy(h * t)
                    const x0 = fx(inset)
                    const x1 = fx(w - inset)
                    const midX = (x0 + x1) / 2
                    const bowY = flipVertical ? y + curvature : y - curvature
                    d =
                        curvature === 0
                            ? `M ${x0},${y} L ${x1},${y}`
                            : `M ${x0},${y} Q ${midX},${bowY} ${x1},${y}`
                    axis = "x"
                    endX = x0
                    endY = y
                } else {
                    const x = fx(w * t)
                    const y0 = fy(inset)
                    const y1 = fy(h - inset)
                    const midY = (y0 + y1) / 2
                    const bowX = flipHorizontal ? x - curvature : x + curvature
                    d =
                        curvature === 0
                            ? `M ${x},${y0} L ${x},${y1}`
                            : `M ${x},${y0} Q ${bowX},${midY} ${x},${y1}`
                    axis = "y"
                    endX = x
                    endY = y0
                }

                next.push({
                    d,
                    axis,
                    endX,
                    endY,
                    delay: delay + i * stagger,
                    duration:
                        speedVariation > 0
                            ? duration + ((i * 1.3) % (speedVariation * 2))
                            : duration,
                })
            }

            setLines(next)
            setMeetPoint({ x: fx(w * convergeX), y: fy(h * convergeY) })
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
        flipVertical,
        flipHorizontal,
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

    // Gradient sweep along one axis, honouring flips + reverse.
    const sweep = (axis: "x" | "y", L: number) => {
        // Base direction: converge beams travel from fan-out -> meet point.
        let rev = reverse
        if (axis === "y" && flipVertical) rev = !rev
        if (axis === "x" && flipHorizontal) rev = !rev
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
        overflow: "visible",
        ...style,
    }

    // Card anchoring: cards sit just past the fan-out end of each line.
    // In converge mode the fan-out edge is the top (or bottom if flipped).
    const cardStyleFor = (line: BeamLine): CSSProperties => {
        const base: CSSProperties = {
            position: "absolute",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: cardBackground,
            color: cardTextColor,
            border: `${cardBorderWidth}px solid ${cardBorderColor}`,
            borderRadius: cardRadius,
            padding: `${cardPaddingY}px ${cardPaddingX}px`,
            fontSize,
            fontWeight,
            fontFamily: "Inter, system-ui, sans-serif",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            zIndex: 1,
        }
        if (mode === "converge" || orientation === "vertical") {
            // Line ends vertically: card above (or below when flipped)
            base.left = line.endX
            if (flipVertical) {
                base.top = line.endY
                base.transform = "translate(-50%, 0%)"
            } else {
                base.top = line.endY
                base.transform = "translate(-50%, -100%)"
            }
        } else {
            // Horizontal parallel lines: card at the left (or right) end
            base.top = line.endY
            base.left = line.endX
            base.transform = flipHorizontal
                ? "translate(0%, -50%)"
                : "translate(-100%, -50%)"
        }
        return base
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
                    const coords = sweep(line.axis, beamLength)
                    return (
                        <g key={i}>
                            <path
                                d={line.d}
                                stroke={pathColor}
                                strokeWidth={pathWidth}
                                strokeOpacity={pathOpacity}
                                strokeLinecap="round"
                            />
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

            {/* Cards at fan-out ends */}
            {showCards &&
                lines.map((line, i) => {
                    const item = cards[i]
                    if (!item || (!item.text && !item.icon)) return null
                    return (
                        <div key={`card-${i}`} style={cardStyleFor(line)}>
                            {item.icon && (
                                <img
                                    src={item.icon}
                                    alt=""
                                    draggable={false}
                                    style={{
                                        width: cardIconSize,
                                        height: cardIconSize,
                                        objectFit: "contain",
                                        flex: "none",
                                    }}
                                />
                            )}
                            {item.text && <span>{item.text}</span>}
                        </div>
                    )
                })}

            {/* Icon at the convergence point */}
            {mode === "converge" && meetIcon && (
                <div
                    style={{
                        position: "absolute",
                        left: meetPoint.x,
                        top: meetPoint.y,
                        transform: "translate(-50%, -50%)",
                        width: meetIconSize,
                        height: meetIconSize,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: meetIconBackground,
                        border: `${meetIconBorderWidth}px solid ${meetIconBorderColor}`,
                        borderRadius: meetIconRadius,
                        padding: meetIconPadding,
                        boxSizing: "border-box",
                        boxShadow: "0 0 20px -12px rgba(0,0,0,0.8)",
                        zIndex: 2,
                        overflow: "hidden",
                    }}
                >
                    <img
                        src={meetIcon}
                        alt=""
                        draggable={false}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                        }}
                    />
                </div>
            )}
        </div>
    )
}

const cardControl = {
    type: ControlType.Object,
    controls: {
        text: {
            type: ControlType.String,
            title: "Text",
            defaultValue: "Label",
        },
        icon: { type: ControlType.Image, title: "Icon" },
    },
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
    flipVertical: {
        type: ControlType.Boolean,
        title: "Flip Vertical",
        defaultValue: false,
    },
    flipHorizontal: {
        type: ControlType.Boolean,
        title: "Flip Horizontal",
        defaultValue: false,
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

    // Meet icon
    meetIcon: {
        type: ControlType.Image,
        title: "Meet Icon",
        hidden: (p: any) => p.mode !== "converge",
    },
    meetIconSize: {
        type: ControlType.Number,
        title: "Icon Size",
        min: 24,
        max: 160,
        defaultValue: 48,
        hidden: (p: any) => p.mode !== "converge" || !p.meetIcon,
    },
    meetIconBackground: {
        type: ControlType.Color,
        title: "Icon BG",
        defaultValue: "#18181b",
        hidden: (p: any) => p.mode !== "converge" || !p.meetIcon,
    },
    meetIconBorderColor: {
        type: ControlType.Color,
        title: "Icon Border",
        defaultValue: "#3f3f46",
        hidden: (p: any) => p.mode !== "converge" || !p.meetIcon,
    },
    meetIconBorderWidth: {
        type: ControlType.Number,
        title: "Icon Border W",
        min: 0,
        max: 6,
        defaultValue: 1,
        hidden: (p: any) => p.mode !== "converge" || !p.meetIcon,
    },
    meetIconRadius: {
        type: ControlType.Number,
        title: "Icon Radius",
        min: 0,
        max: 999,
        defaultValue: 999,
        hidden: (p: any) => p.mode !== "converge" || !p.meetIcon,
    },
    meetIconPadding: {
        type: ControlType.Number,
        title: "Icon Padding",
        min: 0,
        max: 40,
        defaultValue: 10,
        hidden: (p: any) => p.mode !== "converge" || !p.meetIcon,
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
        defaultValue: 40,
        description: "Gap from the edges",
    },

    // Cards
    showCards: {
        type: ControlType.Boolean,
        title: "Cards",
        defaultValue: true,
    },
    cards: {
        type: ControlType.Array,
        title: "Card Labels",
        control: cardControl,
        maxCount: 9,
        defaultValue: [
            { text: "Notion" },
            { text: "Drive" },
            { text: "Docs" },
            { text: "Zapier" },
            { text: "Slack" },
            { text: "Gmail" },
        ],
        hidden: (p: any) => !p.showCards,
    },
    cardBackground: {
        type: ControlType.Color,
        title: "Card BG",
        defaultValue: "#18181b",
        hidden: (p: any) => !p.showCards,
    },
    cardTextColor: {
        type: ControlType.Color,
        title: "Card Text",
        defaultValue: "#fafafa",
        hidden: (p: any) => !p.showCards,
    },
    cardBorderColor: {
        type: ControlType.Color,
        title: "Card Border",
        defaultValue: "#3f3f46",
        hidden: (p: any) => !p.showCards,
    },
    cardBorderWidth: {
        type: ControlType.Number,
        title: "Border W",
        min: 0,
        max: 6,
        defaultValue: 1,
        hidden: (p: any) => !p.showCards,
    },
    cardRadius: {
        type: ControlType.Number,
        title: "Card Radius",
        min: 0,
        max: 40,
        defaultValue: 10,
        hidden: (p: any) => !p.showCards,
    },
    cardPaddingX: {
        type: ControlType.Number,
        title: "Pad X",
        min: 0,
        max: 40,
        defaultValue: 14,
        hidden: (p: any) => !p.showCards,
    },
    cardPaddingY: {
        type: ControlType.Number,
        title: "Pad Y",
        min: 0,
        max: 40,
        defaultValue: 8,
        hidden: (p: any) => !p.showCards,
    },
    cardIconSize: {
        type: ControlType.Number,
        title: "Card Icon Size",
        min: 10,
        max: 48,
        defaultValue: 18,
        hidden: (p: any) => !p.showCards,
    },
    fontSize: {
        type: ControlType.Number,
        title: "Font Size",
        min: 8,
        max: 32,
        defaultValue: 13,
        hidden: (p: any) => !p.showCards,
    },
    fontWeight: {
        type: ControlType.Enum,
        title: "Weight",
        options: [400, 500, 600, 700],
        optionTitles: ["Regular", "Medium", "Semibold", "Bold"],
        defaultValue: 500,
        hidden: (p: any) => !p.showCards,
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
