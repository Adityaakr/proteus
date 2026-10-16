import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

interface LogoImage {
    src: string
    alt?: string
}

interface LogoItem {
    image?: LogoImage
}

interface LogoGridProps {
    logos: LogoItem[]
    autoplay: boolean
    interval: number
    stagger: number
    rows: number
    columns: number
    direction: "Up" | "Down"
    springStiffness: number
    springDamping: number
    transitionBlur: number
    desaturate: number
    surface: string
    cardBackground: string
    borderColor: string
    radius: string
    gap: number
    padding: number
    cellPadding: number
    logoSize: number
    logoScale: number
    alignment: "start" | "center" | "end"
    style?: CSSProperties
}

const defaultLogos: LogoItem[] = [
    { image: { src: "https://framerusercontent.com/images/KZ8bnE5Hi79YPAmKrnWg0y4k.svg" } },
    { image: { src: "https://framerusercontent.com/images/Du0asJvd40oxrJTmg35o8HLLKYU.svg" } },
    { image: { src: "https://framerusercontent.com/images/TRWHymIVOzhrlKk9Kgp6wVtfJg.svg" } },
    { image: { src: "https://framerusercontent.com/images/wyNzEJcUM6FxPf4obHdsfESRTg4.svg" } },
    { image: { src: "https://framerusercontent.com/images/9IZoaPyfq4yThTVHnAyFAWsxdEg.svg" } },
    { image: { src: "https://framerusercontent.com/images/XuV68yxQh1X1TF7uODMNgafIzB4.svg" } },
    { image: { src: "https://framerusercontent.com/images/KNGYx9yvbOgG2DDc9IRcWnLAKk4.svg" } },
]

/**
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 720
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function LogoGrid(props: LogoGridProps) {
    const {
        logos = defaultLogos,
        autoplay = true,
        interval = 3600,
        stagger = 150,
        rows = 3,
        columns = 3,
        direction = "Up",
        springStiffness = 230,
        springDamping = 19,
        transitionBlur = 6,
        desaturate = 0,
        surface = "#F7F7F6",
        cardBackground = "#FFFFFF",
        borderColor = "rgba(17,17,17,0.12)",
        radius = "16px",
        gap = 12,
        padding = 28,
        cellPadding = 20,
        logoSize = 72,
        logoScale = 100,
        alignment = "center",
    } = props

    const items = logos.length > 0 ? logos : defaultLogos
    const cellCount = Math.max(1, Math.round(rows) * Math.round(columns))
    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const [visibleIndexes, setVisibleIndexes] = useState(() =>
        Array.from({ length: cellCount }, (_, index) => (index * 2) % items.length)
    )
    const sourceSignature = useMemo(
        () => items.map((item) => item.image?.src || "").join("|"),
        [items]
    )

    useEffect(() => {
        setVisibleIndexes(Array.from({ length: cellCount }, (_, index) => (index * 2) % items.length))
    }, [cellCount, sourceSignature])

    useEffect(() => {
        if (typeof window === "undefined" || isStatic || reducedMotion || !autoplay) return

        const timers = Array.from({ length: cellCount }, (_, cellIndex) => {
            const advance = () => {
                setVisibleIndexes((current) =>
                    current.map((value, index) => {
                        if (index !== cellIndex) return value
                        const first = (cellIndex * 2) % items.length
                        const second = (first + 1) % items.length
                        return value === first ? second : first
                    })
                )
            }
            const timer: { delay: number; loop?: number } = { delay: 0 }
            timer.delay = window.setTimeout(() => {
                advance()
                timer.loop = window.setInterval(advance, Math.max(1200, interval))
            }, Math.max(0, cellIndex * stagger + interval))
            return timer
        })

        return () => {
            timers.forEach(({ delay, loop }) => {
                window.clearTimeout(delay)
                if (loop) window.clearInterval(loop)
            })
        }
    }, [autoplay, cellCount, interval, isStatic, items.length, reducedMotion, stagger])

    const slideDistance = direction === "Up" ? "70%" : "-70%"
    const exitDistance = direction === "Up" ? "-70%" : "70%"

    return (
        <section
            style={{
                ...props.style,
                position: "relative",
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                padding,
                display: "grid",
                overflow: "hidden",
                background: surface,
                fontFamily: "PP Neue Montreal, Inter, sans-serif",
            }}
        >
            <div
                aria-label="Companies using Fantom"
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.max(1, Math.round(columns))}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${Math.max(1, Math.round(rows))}, minmax(0, 1fr))`,
                    gap,
                    width: "100%",
                    height: "100%",
                }}
            >
                {visibleIndexes.map((logoIndex, cellIndex) => {
                    const logo = items[logoIndex]
                    return (
                        <div
                            key={cellIndex}
                            style={{
                                position: "relative",
                                overflow: "visible",
                                border: `1px solid ${borderColor}`,
                                borderRadius: radius,
                                background: cardBackground,
                                display: "grid",
                                placeItems: alignment,
                            }}
                        >
                            <AnimatePresence initial={false} mode="sync">
                                <motion.div
                                    key={`${cellIndex}-${logoIndex}`}
                                    initial={
                                        reducedMotion
                                            ? false
                                            : { y: slideDistance, opacity: 0, filter: `blur(${transitionBlur}px)` }
                                    }
                                    animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                                    exit={
                                        reducedMotion
                                            ? undefined
                                            : { y: exitDistance, opacity: 0, filter: `blur(${transitionBlur}px)` }
                                    }
                                    transition={
                                        reducedMotion
                                            ? { duration: 0 }
                                            : {
                                                  type: "spring",
                                                  stiffness: springStiffness,
                                                  damping: springDamping,
                                                  mass: 0.68,
                                              }
                                    }
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        display: "grid",
                                        placeItems: alignment,
                                        padding: cellPadding,
                                    }}
                                >
                                    {logo.image?.src ? (
                                        <div
                                            style={{
                                                width: "100%",
                                                height: `${logoSize}px`,
                                                display: "grid",
                                                placeItems: "center",
                                                transform: `scale(${Math.max(20, Math.min(100, logoScale)) / 100})`,
                                                transformOrigin: "center",
                                            }}
                                        >
                                            <img
                                                src={logo.image.src}
                                                alt={logo.image.alt || ""}
                                                style={{
                                                    display: "block",
                                                    width: "auto",
                                                    height: "100%",
                                                    maxWidth: "100%",
                                                    objectFit: "contain",
                                                    filter: `grayscale(${Math.max(0, Math.min(100, desaturate))}%)`,
                                                }}
                                            />
                                        </div>
                                    ) : null}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    )
                })}
            </div>

        </section>
    )
}

addPropertyControls(LogoGrid, {
    logos: {
        type: ControlType.Array,
        title: "Logo Pairs",
        description: "Every two uploaded logos swap within one grid cell.",
        maxCount: 30,
        control: {
            type: ControlType.Object,
            controls: {
                image: { type: ControlType.ResponsiveImage, title: "Logo" },
            },
        },
        defaultValue: defaultLogos,
    },
    autoplay: { type: ControlType.Boolean, title: "Autoplay", defaultValue: true },
    rows: { type: ControlType.Number, title: "Rows", defaultValue: 3, min: 1, max: 6, step: 1 },
    columns: { type: ControlType.Number, title: "Columns", defaultValue: 3, min: 1, max: 6, step: 1 },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["Up", "Down"],
        defaultValue: "Up",
    },
    interval: {
        type: ControlType.Number,
        title: "Interval",
        defaultValue: 3600,
        min: 1200,
        max: 10000,
        step: 100,
        unit: "ms",
    },
    stagger: {
        type: ControlType.Number,
        title: "Stagger",
        defaultValue: 150,
        min: 0,
        max: 800,
        step: 10,
        unit: "ms",
        hidden: ({ autoplay }) => !autoplay,
    },
    springStiffness: {
        type: ControlType.Number,
        title: "Spring Strength",
        defaultValue: 230,
        min: 100,
        max: 400,
        step: 5,
        hidden: ({ autoplay }) => !autoplay,
    },
    springDamping: {
        type: ControlType.Number,
        title: "Spring Damping",
        defaultValue: 19,
        min: 10,
        max: 35,
        step: 1,
        hidden: ({ autoplay }) => !autoplay,
    },
    transitionBlur: {
        type: ControlType.Number,
        title: "Transition Blur",
        defaultValue: 6,
        min: 0,
        max: 20,
        step: 1,
        unit: "px",
        hidden: ({ autoplay }) => !autoplay,
    },
    desaturate: {
        type: ControlType.Number,
        title: "Desaturate",
        defaultValue: 0,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
    },
    surface: { type: ControlType.Color, title: "Surface", defaultValue: "#F7F7F6" },
    cardBackground: { type: ControlType.Color, title: "Card Fill", defaultValue: "#FFFFFF" },
    borderColor: { type: ControlType.Color, title: "Border", defaultValue: "rgba(17,17,17,0.12)" },
    radius: { type: ControlType.BorderRadius, title: "Radius", defaultValue: "16px" },
    gap: {
        type: ControlType.Number,
        title: "Grid Gap",
        defaultValue: 12,
        min: 0,
        max: 36,
        step: 1,
        unit: "px",
    },
    padding: {
        type: ControlType.Number,
        title: "Outer Padding",
        defaultValue: 28,
        min: 0,
        max: 100,
        step: 1,
        unit: "px",
    },
    cellPadding: {
        type: ControlType.Number,
        title: "Cell Padding",
        defaultValue: 20,
        min: 0,
        max: 80,
        step: 1,
        unit: "px",
    },
    logoSize: {
        type: ControlType.Number,
        title: "Logo Height",
        defaultValue: 48,
        min: 16,
        max: 100,
        step: 1,
        unit: "px",
    },
    logoScale: {
        type: ControlType.Number,
        title: "Logo Scale",
        defaultValue: 100,
        min: 20,
        max: 100,
        step: 1,
        unit: "%",
    },
    alignment: {
        type: ControlType.Enum,
        title: "Alignment",
        options: ["start", "center", "end"],
        optionTitles: ["Start", "Center", "End"],
        defaultValue: "center",
    },
})
