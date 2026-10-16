import { useRef, type CSSProperties } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "../lib/framer-shim"
import { motion, useInView } from "framer-motion"

interface ImpactGraphProps {
    mode: "line" | "area" | "bars" | "radial"
    color: string
    secondaryColor: string
    gridColor: string
    duration: number
    value: number
    style?: CSSProperties
}

/**
 * Animated product-impact chart with line, area, bar, and radial modes.
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function ImpactGraph(props: ImpactGraphProps) {
    const {
        mode = "line",
        color = "#012BFF",
        secondaryColor = "#09AEFF",
        gridColor = "rgba(0,0,0,0.1)",
        duration = 1.4,
        value = 78,
        style,
    } = props
    const ref = useRef<HTMLDivElement>(null)
    const isStatic = useIsStaticRenderer()
    const isInView = useInView(ref, { once: false, amount: 0.3 })
    const active = isStatic || isInView
    const transition = { duration, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
    const linePath = "M8 92 C40 88 56 68 84 72 C118 77 128 42 160 50 C188 57 204 24 236 30 C262 35 278 14 312 18"
    const areaPath = linePath + " L312 112 L8 112 Z"
    const bars = [38, 58, 46, 74, 62, 88, 78]
    const radius = 42
    const circumference = 2 * Math.PI * radius
    const dash = circumference * Math.max(0, Math.min(100, value)) / 100

    return (
        <div ref={ref} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }} role="img" aria-label={mode + " impact graph"}>
            <svg viewBox="0 0 320 120" width="100%" height="100%" preserveAspectRatio={mode === "radial" ? "xMidYMid meet" : "none"}>
                {mode !== "radial" && [28, 56, 84, 112].map((y) => <line key={y} x1="0" y1={y} x2="320" y2={y} stroke={gridColor} strokeWidth="1" />)}
                {mode === "bars" && bars.map((height, i) => (
                    <motion.rect
                        key={i}
                        x={14 + i * 44}
                        y={112 - height}
                        width="24"
                        height={height}
                        rx="4"
                        fill={i === bars.length - 1 ? secondaryColor : color}
                        initial={isStatic ? false : { scaleY: 0, transformOrigin: "bottom" }}
                        animate={{ scaleY: active ? 1 : 0 }}
                        transition={{ ...transition, delay: i * 0.06 }}
                    />
                ))}
                {mode === "area" && (
                    <>
                        <motion.path d={areaPath} fill={color} opacity="0.12" initial={isStatic ? false : { opacity: 0 }} animate={{ opacity: active ? 0.12 : 0 }} transition={transition} />
                        <motion.path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" initial={isStatic ? false : { pathLength: 0 }} animate={{ pathLength: active ? 1 : 0 }} transition={transition} />
                    </>
                )}
                {mode === "line" && (
                    <>
                        <motion.path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" initial={isStatic ? false : { pathLength: 0 }} animate={{ pathLength: active ? 1 : 0 }} transition={transition} />
                        <motion.circle cx="312" cy="18" r="5" fill={secondaryColor} initial={isStatic ? false : { scale: 0 }} animate={{ scale: active ? 1 : 0 }} transition={{ ...transition, delay: duration * 0.7 }} />
                    </>
                )}
                {mode === "radial" && (
                    <g transform="translate(160 60) rotate(-90)">
                        <circle cx="0" cy="0" r={radius} fill="none" stroke={gridColor} strokeWidth="10" />
                        <motion.circle cx="0" cy="0" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} initial={isStatic ? false : { strokeDashoffset: circumference }} animate={{ strokeDashoffset: active ? circumference - dash : circumference }} transition={transition} />
                    </g>
                )}
                {mode === "radial" && <text x="160" y="67" textAnchor="middle" fill={color} fontFamily="Geist, sans-serif" fontSize="22" fontWeight="600">{value}%</text>}
            </svg>
        </div>
    )
}

addPropertyControls(ImpactGraph, {
    mode: { type: ControlType.Enum, title: "Mode", options: ["line", "area", "bars", "radial"], optionTitles: ["Line", "Area", "Bars", "Radial"], defaultValue: "line", displaySegmentedControl: true },
    color: { type: ControlType.Color, title: "Primary", defaultValue: "#012BFF" },
    secondaryColor: { type: ControlType.Color, title: "Accent", defaultValue: "#09AEFF" },
    gridColor: { type: ControlType.Color, title: "Grid", defaultValue: "rgba(0,0,0,0.1)" },
    duration: { type: ControlType.Number, title: "Duration", defaultValue: 1.4, min: 0.3, max: 4, step: 0.1, unit: "s" },
    value: { type: ControlType.Number, title: "Value", defaultValue: 78, min: 0, max: 100, step: 1, unit: "%" },
})
