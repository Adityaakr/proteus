import { addPropertyControls, ControlType } from "framer"
import { useEffect, useRef, useState } from "react"

export default function RotatingArcs(props) {
    const {
        tickColor,
        tickCount,
        tickLength,
        tickWidth,
        gap,
        speed,
        curvature,
        topOffset,
        showDivider,
        dividerColor,
        dividerWidth,
    } = props

    const containerRef = useRef<HTMLDivElement>(null)
    const outerRef = useRef<SVGGElement>(null)
    const innerRef = useRef<SVGGElement>(null)
    const raf = useRef(0)
    const [size, setSize] = useState({ w: 800, h: 400 })

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect
            if (width && height) setSize({ w: width, h: height })
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    useEffect(() => {
        let angle = 0
        let last = performance.now()
        const loop = (now: number) => {
            const dt = (now - last) / 1000
            last = now
            angle += speed * dt
            if (outerRef.current)
                outerRef.current.style.transform = `rotate(${angle}deg)`
            if (innerRef.current)
                innerRef.current.style.transform = `rotate(${-angle}deg)`
            raf.current = requestAnimationFrame(loop)
        }
        raf.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(raf.current)
    }, [speed])

    const { w, h } = size

    const minR = w * 0.55
    const maxR = w * 4
    const outerR = maxR - (maxR - minR) * curvature

    // Layout from outside in:
    // outer ticks (outerR → outerR - tickLength)
    // half gap → divider line → half gap
    // inner ticks (innerR → innerR - tickLength)
    const dividerR = outerR - tickLength - gap / 2
    const innerR = dividerR - gap / 2

    const cx = w / 2
    const cy = topOffset + outerR

    const ticks = (radius: number) => {
        const arr = []
        const stepDeg = 360 / tickCount
        for (let i = 0; i < tickCount; i++) {
            arr.push(
                <line
                    key={i}
                    x1={cx}
                    y1={cy - radius}
                    x2={cx}
                    y2={cy - radius + tickLength}
                    stroke={tickColor}
                    strokeWidth={tickWidth}
                    strokeLinecap="round"
                    transform={`rotate(${i * stepDeg} ${cx} ${cy})`}
                />
            )
        }
        return arr
    }

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
                position: "relative",
            }}
        >
            <svg
                width={w}
                height={h}
                viewBox={`0 0 ${w} ${h}`}
                style={{ position: "absolute", inset: 0 }}
            >
                <g
                    ref={outerRef}
                    style={{ transformOrigin: `${cx}px ${cy}px` }}
                >
                    {ticks(outerR)}
                </g>

                {showDivider && (
                    <circle
                        cx={cx}
                        cy={cy}
                        r={dividerR}
                        fill="none"
                        stroke={dividerColor}
                        strokeWidth={dividerWidth}
                    />
                )}

                <g
                    ref={innerRef}
                    style={{ transformOrigin: `${cx}px ${cy}px` }}
                >
                    {ticks(innerR)}
                </g>
            </svg>
        </div>
    )
}

RotatingArcs.defaultProps = {
    tickColor: "#E4E4E9",
    tickCount: 160,
    tickLength: 36,
    tickWidth: 2,
    gap: 48,
    speed: 4,
    curvature: 0.6,
    topOffset: 40,
    showDivider: true,
    dividerColor: "#ECECF1",
    dividerWidth: 1.5,
}

addPropertyControls(RotatingArcs, {
    tickColor: { type: ControlType.Color, title: "Tick Color" },
    curvature: {
        type: ControlType.Number,
        title: "Curvature",
        min: 0,
        max: 1,
        step: 0.01,
    },
    topOffset: {
        type: ControlType.Number,
        title: "Top Offset",
        min: -400,
        max: 400,
    },
    tickCount: {
        type: ControlType.Number,
        title: "Tick Density",
        min: 40,
        max: 600,
        step: 1,
    },
    tickLength: {
        type: ControlType.Number,
        title: "Tick Length",
        min: 8,
        max: 120,
    },
    gap: {
        type: ControlType.Number,
        title: "Ring Gap",
        min: 8,
        max: 200,
    },
    tickWidth: {
        type: ControlType.Number,
        title: "Tick Width",
        min: 0.5,
        max: 8,
        step: 0.5,
    },
    speed: {
        type: ControlType.Number,
        title: "Speed (°/s)",
        min: 0,
        max: 60,
    },
    showDivider: { type: ControlType.Boolean, title: "Divider" },
    dividerColor: {
        type: ControlType.Color,
        title: "Divider Color",
        hidden: (p) => !p.showDivider,
    },
    dividerWidth: {
        type: ControlType.Number,
        title: "Divider Width",
        min: 0.5,
        max: 6,
        step: 0.5,
        hidden: (p) => !p.showDivider,
    },
})
