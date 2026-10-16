import { useId, useRef, type CSSProperties } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "../lib/framer-shim"
import { motion, useInView } from "framer-motion"

interface GrowthGraphProps {
    lineColor: string
    useLineGradient: boolean
    lineEndColor: string
    fillColor: string
    ruleColor: string
    startHeight: number
    endHeight: number
    duration: number
    showRules: boolean
    style?: CSSProperties
}

/**
 * Full-bleed animated exponential growth curve with clipped vertical rules.
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function GrowthGraph(props: GrowthGraphProps) {
    const {
        lineColor = "#012BFF",
        useLineGradient = false,
        lineEndColor = "#09AEFF",
        fillColor = "rgba(1, 43, 255, 0.06)",
        ruleColor = "rgba(1, 43, 255, 0.12)",
        startHeight = 3.3,
        endHeight = 100,
        duration = 1.8,
        showRules = true,
        style,
    } = props
    const ref = useRef<HTMLDivElement>(null)
    const isStatic = useIsStaticRenderer()
    const isInView = useInView(ref, { once: false, amount: 0.2 })
    const active = isStatic || isInView
    const clipId = "growth-" + useId().replace(/:/g, "")
    const clampedStartHeight = Math.max(0, Math.min(100, startHeight))
    const clampedEndHeight = Math.max(0, Math.min(100, endHeight))
    const startY = 120 - (clampedStartHeight / 100) * 120
    const endY = 120 - (clampedEndHeight / 100) * 120
    const rise = startY - endY
    const curve = `M0 ${startY} C64 ${startY} 124 ${startY - rise * 0.05} 178 ${startY - rise * 0.24} C236 ${startY - rise * 0.46} 278 ${startY - rise * 0.73} 320 ${endY}`
    const area = curve + " L320 120 L0 120 Z"
    const rules = Array.from({ length: 101 }, (_, index) => index * 3.2)
    const transition = { duration, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }

    return (
        <div ref={ref} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }} role="img" aria-label="Accelerating product growth curve">
            <svg viewBox="0 0 320 120" width="100%" height="100%" preserveAspectRatio="none">
                <defs>
                    <clipPath id={clipId}><path d={area} /></clipPath>
                    <linearGradient id={clipId + "-fill"} x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0" stopColor={fillColor} stopOpacity="0.18" />
                        <stop offset="1" stopColor={fillColor} stopOpacity="0.7" />
                    </linearGradient>
                    <linearGradient id={clipId + "-line"} x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0" stopColor={lineColor} />
                        <stop offset="1" stopColor={lineEndColor} />
                    </linearGradient>
                </defs>
                <motion.path d={area} fill={`url(#${clipId}-fill)`} initial={isStatic ? false : { opacity: 0 }} animate={{ opacity: active ? 1 : 0 }} transition={transition} />
                {showRules && (
                    <motion.g clipPath={`url(#${clipId})`} initial={isStatic ? false : { opacity: 0 }} animate={{ opacity: active ? 1 : 0 }} transition={{ ...transition, delay: isStatic ? 0 : 0.25 }}>
                        {rules.map((x) => <line key={x} x1={x} y1="0" x2={x} y2="120" stroke={ruleColor} strokeWidth="0.24" />)}
                    </motion.g>
                )}
                <motion.path d={curve} fill="none" stroke={useLineGradient ? `url(#${clipId}-line)` : lineColor} strokeWidth="0.72" strokeLinecap="round" initial={isStatic ? false : { pathLength: 0 }} animate={{ pathLength: active ? 1 : 0 }} transition={transition} />
            </svg>
        </div>
    )
}

addPropertyControls(GrowthGraph, {
    lineColor: { type: ControlType.Color, title: "Line Start", defaultValue: "#012BFF" },
    useLineGradient: { type: ControlType.Boolean, title: "Line Gradient", defaultValue: false },
    lineEndColor: { type: ControlType.Color, title: "Line End", defaultValue: "#09AEFF", hidden: (props: any) => !props.useLineGradient },
    fillColor: { type: ControlType.Color, title: "Area", defaultValue: "rgba(1, 43, 255, 0.06)" },
    ruleColor: { type: ControlType.Color, title: "Rules", defaultValue: "rgba(1, 43, 255, 0.12)" },
    startHeight: { type: ControlType.Number, title: "Start Height", defaultValue: 3.3, min: 0, max: 100, step: 1, unit: "%" },
    endHeight: { type: ControlType.Number, title: "End Height", defaultValue: 100, min: 0, max: 100, step: 1, unit: "%" },
    duration: { type: ControlType.Number, title: "Duration", defaultValue: 1.8, min: 0.4, max: 4, step: 0.1, unit: "s" },
    showRules: { type: ControlType.Boolean, title: "Rules", defaultValue: true },
})
