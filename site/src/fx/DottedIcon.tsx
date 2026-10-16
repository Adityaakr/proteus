import {
    startTransition,
    useEffect,
    useId,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "../lib/framer-shim"

type DetectionMode = "alpha" | "dark" | "light"
type ImageFit = "contain" | "cover" | "stretch"
type RenderStyle = "dots" | "pixels" | "gradient"
type MatrixColorMode = "solid" | "gradient"

interface DottedIconProps {
    source?: string
    fit: ImageFit
    renderStyle: RenderStyle
    matrixColorMode: MatrixColorMode
    columns: number
    dotScale: number
    pixelScale: number
    pixelRadius: number
    gradientColor1: string
    gradientColor2: string
    gradientColor3: string
    gradientColor4: string
    gradientColor5: string
    gradientAngle: number
    threshold: number
    detection: DetectionMode
    invert: boolean
    activeColor: string
    inactiveColor: string
    inactiveOpacity: number
    glow: number
    shimmer: boolean
    shimmerColor: string
    shimmerIntensity: number
    shimmerWidth: number
    shimmerDuration: number
    shimmerAngle: number
    background: string
    radius: number
    padding: number
    ariaLabel: string
    style?: CSSProperties
}

interface DotGrid {
    width: number
    height: number
    columns: number
    rows: number
    values: number[]
}

const FALLBACK_ICON =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath fill='white' d='M55 6 18 55h27l-4 39 41-56H55z'/%3E%3C/svg%3E"

function clamp(value: number, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value))
}

function getDrawRect(
    imageWidth: number,
    imageHeight: number,
    targetWidth: number,
    targetHeight: number,
    fit: ImageFit
) {
    if (fit === "stretch") {
        return { x: 0, y: 0, width: targetWidth, height: targetHeight }
    }

    const scale =
        fit === "cover"
            ? Math.max(targetWidth / imageWidth, targetHeight / imageHeight)
            : Math.min(targetWidth / imageWidth, targetHeight / imageHeight)
    const width = imageWidth * scale
    const height = imageHeight * scale

    return {
        x: (targetWidth - width) / 2,
        y: (targetHeight - height) / 2,
        width,
        height,
    }
}

/**
 * Dotted Icon
 *
 * Converts an uploaded PNG or SVG into a responsive LED-style dot matrix.
 *
 * @framerIntrinsicWidth 240
 * @framerIntrinsicHeight 240
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function DottedIcon(props: DottedIconProps) {
    const {
        source = FALLBACK_ICON,
        fit = "contain",
        renderStyle = "dots",
        matrixColorMode = "solid",
        columns = 24,
        dotScale = 0.62,
        pixelScale = 0.92,
        pixelRadius = 0,
        gradientColor1 = "#00E5FF",
        gradientColor2 = "#315CFF",
        gradientColor3 = "#A83CFF",
        gradientColor4 = "#FF5F9E",
        gradientColor5 = "#FFE14A",
        gradientAngle = 25,
        threshold = 0.16,
        detection = "alpha",
        invert = false,
        activeColor = "#FFFFFF",
        inactiveColor = "#66717A",
        inactiveOpacity = 0.16,
        glow = 8,
        shimmer = true,
        shimmerColor = "#BCEBFF",
        shimmerIntensity = 0.9,
        shimmerWidth = 0.2,
        shimmerDuration = 1.8,
        shimmerAngle = 20,
        background = "#050708",
        radius = 16,
        padding = 16,
        ariaLabel = "Dotted icon",
    } = props

    const rootRef = useRef<HTMLDivElement>(null)
    const isStatic = useIsStaticRenderer()
    const [error, setError] = useState("")
    const [grid, setGrid] = useState<DotGrid | null>(null)
    const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "")
    const animationName = `dotted-icon-shimmer-${instanceId}`

    useEffect(() => {
        if (typeof window === "undefined") return

        const root = rootRef.current
        if (!root) return

        let disposed = false

        const image = new Image()
        image.crossOrigin = "anonymous"

        const sampleImage = () => {
            if (!image.naturalWidth || !image.naturalHeight) return

            const rect = root.getBoundingClientRect()
            const logicalWidth = Math.max(1, rect.width)
            const logicalHeight = Math.max(1, rect.height)
            const innerWidth = Math.max(1, logicalWidth - padding * 2)
            const innerHeight = Math.max(1, logicalHeight - padding * 2)
            const gridColumns = Math.max(4, Math.round(columns))
            const gridRows = Math.max(
                1,
                Math.round(gridColumns * (innerHeight / innerWidth))
            )

            const sampler = document.createElement("canvas")
            sampler.width = gridColumns
            sampler.height = gridRows
            const sampleContext = sampler.getContext("2d", {
                willReadFrequently: true,
            })
            if (!sampleContext) return

            sampleContext.clearRect(0, 0, gridColumns, gridRows)
            const imageRect = getDrawRect(
                image.naturalWidth,
                image.naturalHeight,
                gridColumns,
                gridRows,
                fit
            )
            sampleContext.drawImage(
                image,
                imageRect.x,
                imageRect.y,
                imageRect.width,
                imageRect.height
            )

            try {
                const pixels = sampleContext.getImageData(
                    0,
                    0,
                    gridColumns,
                    gridRows
                ).data
                const activity = new Float32Array(gridColumns * gridRows)

                for (let index = 0; index < activity.length; index++) {
                    const offset = index * 4
                    const alpha = pixels[offset + 3] / 255
                    const luminance =
                        (pixels[offset] * 0.2126 +
                            pixels[offset + 1] * 0.7152 +
                            pixels[offset + 2] * 0.0722) /
                        255
                    let score =
                        detection === "alpha"
                            ? alpha
                            : detection === "dark"
                              ? alpha * (1 - luminance)
                              : alpha * luminance
                    if (invert) score = 1 - score
                    activity[index] =
                        score >= threshold
                            ? clamp((score - threshold) / Math.max(0.08, 1 - threshold)) *
                                  0.45 +
                              0.55
                            : 0
                }

                if (disposed) return
                startTransition(() => {
                    setGrid({
                        width: logicalWidth,
                        height: logicalHeight,
                        columns: gridColumns,
                        rows: gridRows,
                        values: Array.from(activity),
                    })
                    setError("")
                })
            } catch (_error) {
                if (!disposed) {
                    startTransition(() => {
                        setGrid(null)
                        setError(
                            "Upload the image to Framer so it can be sampled safely."
                        )
                    })
                }
            }
        }

        image.onload = sampleImage
        image.onerror = () => {
            if (!disposed) {
                startTransition(() => {
                    setGrid(null)
                    setError("This PNG or SVG could not be loaded.")
                })
            }
        }
        image.src = source || FALLBACK_ICON

        const resizeObserver = new ResizeObserver(sampleImage)
        resizeObserver.observe(root)

        return () => {
            disposed = true
            resizeObserver.disconnect()
            image.onload = null
            image.onerror = null
        }
    }, [
        source,
        fit,
        columns,
        threshold,
        detection,
        invert,
        padding,
    ])

    const dots: ReactNode[] = []
    if (grid) {
        const innerWidth = Math.max(1, grid.width - padding * 2)
        const innerHeight = Math.max(1, grid.height - padding * 2)
        const cellWidth = innerWidth / grid.columns
        const cellHeight = innerHeight / grid.rows
        const dotRadius = Math.max(
            0.45,
            (Math.min(cellWidth, cellHeight) * clamp(dotScale, 0.08, 1)) / 2
        )
        const angle = (shimmerAngle * Math.PI) / 180
        const directionX = Math.cos(angle)
        const directionY = Math.sin(angle)
        const corners = [0, directionX, directionY, directionX + directionY]
        const projectionMin = Math.min(...corners)
        const projectionRange = Math.max(
            0.001,
            Math.max(...corners) - projectionMin
        )

        for (let row = 0; row < grid.rows; row++) {
            for (let column = 0; column < grid.columns; column++) {
                const value = grid.values[row * grid.columns + column] || 0
                if (value <= 0) continue
                const nx = grid.columns <= 1 ? 0.5 : column / (grid.columns - 1)
                const ny = grid.rows <= 1 ? 0.5 : row / (grid.rows - 1)
                const projection =
                    (nx * directionX + ny * directionY - projectionMin) /
                    projectionRange
                const staticHighlight =
                    shimmer && isStatic &&
                    Math.abs(projection - 0.5) < clamp(shimmerWidth, 0.02, 0.7)
                const matrixBaseFill =
                    matrixColorMode === "gradient"
                        ? `url(#spectrum-${instanceId})`
                        : activeColor

                const shapeStyle =
                    shimmer && !isStatic
                        ? ({
                              "--dot-base": matrixBaseFill,
                              "--dot-shimmer": shimmerColor,
                              animation: `${animationName} ${Math.max(0.2, shimmerDuration)}s linear infinite`,
                              animationDelay: `${-projection * Math.max(0.2, shimmerDuration)}s`,
                          } as CSSProperties)
                        : undefined
                const shapeFill = staticHighlight ? shimmerColor : matrixBaseFill
                const shapeOpacity = clamp(
                    value + (staticHighlight ? shimmerIntensity * 0.25 : 0)
                )
                const centerX = padding + (column + 0.5) * cellWidth
                const centerY = padding + (row + 0.5) * cellHeight

                if (renderStyle === "pixels") {
                    const pixelWidth = cellWidth * clamp(pixelScale, 0.1, 1)
                    const pixelHeight = cellHeight * clamp(pixelScale, 0.1, 1)
                    const corner =
                        Math.min(pixelWidth, pixelHeight) *
                        clamp(pixelRadius, 0, 0.5)
                    dots.push(
                        <rect
                            key={`${row}-${column}`}
                            x={centerX - pixelWidth / 2}
                            y={centerY - pixelHeight / 2}
                            width={pixelWidth}
                            height={pixelHeight}
                            rx={corner}
                            ry={corner}
                            fill={shapeFill}
                            opacity={shapeOpacity}
                            style={shapeStyle}
                        />
                    )
                } else {
                    dots.push(
                        <circle
                            key={`${row}-${column}`}
                            cx={centerX}
                            cy={centerY}
                            r={dotRadius}
                            fill={shapeFill}
                            opacity={shapeOpacity}
                            style={shapeStyle}
                        />
                    )
                }
            }
        }
    }

    const shimmerHalfWidth = Math.round(clamp(shimmerWidth, 0.02, 0.7) * 35)
    const shimmerPeakOpacity = clamp(0.55 + shimmerIntensity * 0.45)

    return (
        <div
            ref={rootRef}
            role="img"
            aria-label={ariaLabel}
            style={{
                ...props.style,
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                borderRadius: radius,
                backgroundColor: background,
            }}
        >
            <style>{`
                @keyframes ${animationName} {
                    0%, ${50 - shimmerHalfWidth}%, ${50 + shimmerHalfWidth}%, 100% {
                        fill: var(--dot-base);
                    }
                    50% {
                        fill: var(--dot-shimmer);
                        opacity: ${shimmerPeakOpacity};
                    }
                }
            `}</style>
            {grid && (
                <svg
                    aria-hidden="true"
                    viewBox={`0 0 ${grid.width} ${grid.height}`}
                    preserveAspectRatio="none"
                    shapeRendering={renderStyle === "pixels" ? "crispEdges" : "geometricPrecision"}
                    style={{ display: "block", width: "100%", height: "100%" }}
                >
                    <defs>
                        <linearGradient
                            id={`spectrum-${instanceId}`}
                            x1="0"
                            y1={grid.height / 2}
                            x2={grid.width}
                            y2={grid.height / 2}
                            gradientUnits="userSpaceOnUse"
                            gradientTransform={`rotate(${gradientAngle} ${grid.width / 2} ${grid.height / 2})`}
                        >
                            <stop offset="0%" stopColor={gradientColor1} />
                            <stop offset="25%" stopColor={gradientColor2} />
                            <stop offset="50%" stopColor={gradientColor3} />
                            <stop offset="75%" stopColor={gradientColor4} />
                            <stop offset="100%" stopColor={gradientColor5} />
                        </linearGradient>
                        <linearGradient
                            id={`spectrum-shimmer-${instanceId}`}
                            x1={isStatic ? "0.25" : "-1"}
                            y1="0.5"
                            x2={isStatic ? "0.75" : "-0.55"}
                            y2="0.5"
                            gradientTransform={`rotate(${shimmerAngle} 0.5 0.5)`}
                        >
                            <stop offset="0%" stopColor={shimmerColor} stopOpacity="0" />
                            <stop offset="50%" stopColor={shimmerColor} stopOpacity={shimmerIntensity} />
                            <stop offset="100%" stopColor={shimmerColor} stopOpacity="0" />
                            {!isStatic && (
                                <>
                                    <animate
                                        attributeName="x1"
                                        values="-1;1.1"
                                        dur={`${Math.max(0.2, shimmerDuration)}s`}
                                        repeatCount="indefinite"
                                    />
                                    <animate
                                        attributeName="x2"
                                        values="-0.55;1.55"
                                        dur={`${Math.max(0.2, shimmerDuration)}s`}
                                        repeatCount="indefinite"
                                    />
                                </>
                            )}
                        </linearGradient>
                        <mask
                            id={`image-mask-${instanceId}`}
                            x="0"
                            y="0"
                            width={grid.width}
                            height={grid.height}
                            maskUnits="userSpaceOnUse"
                            style={{ maskType: "alpha" } as CSSProperties}
                        >
                            <image
                                href={source || FALLBACK_ICON}
                                x={padding}
                                y={padding}
                                width={Math.max(1, grid.width - padding * 2)}
                                height={Math.max(1, grid.height - padding * 2)}
                                preserveAspectRatio={
                                    fit === "stretch"
                                        ? "none"
                                        : fit === "cover"
                                          ? "xMidYMid slice"
                                          : "xMidYMid meet"
                                }
                            />
                        </mask>
                        <pattern
                            id={`idle-${instanceId}`}
                            width={(grid.width - padding * 2) / grid.columns}
                            height={(grid.height - padding * 2) / grid.rows}
                            patternUnits="userSpaceOnUse"
                            x={padding}
                            y={padding}
                        >
                            {renderStyle === "pixels" ? (
                                <rect
                                    x={
                                        ((grid.width - padding * 2) / grid.columns) *
                                        (1 - clamp(pixelScale, 0.1, 1)) /
                                        2
                                    }
                                    y={
                                        ((grid.height - padding * 2) / grid.rows) *
                                        (1 - clamp(pixelScale, 0.1, 1)) /
                                        2
                                    }
                                    width={
                                        ((grid.width - padding * 2) / grid.columns) *
                                        clamp(pixelScale, 0.1, 1)
                                    }
                                    height={
                                        ((grid.height - padding * 2) / grid.rows) *
                                        clamp(pixelScale, 0.1, 1)
                                    }
                                    rx={
                                        Math.min(
                                            ((grid.width - padding * 2) / grid.columns) *
                                                clamp(pixelScale, 0.1, 1),
                                            ((grid.height - padding * 2) / grid.rows) *
                                                clamp(pixelScale, 0.1, 1)
                                        ) * clamp(pixelRadius, 0, 0.5)
                                    }
                                    fill={inactiveColor}
                                    opacity={clamp(inactiveOpacity)}
                                />
                            ) : (
                                <circle
                                    cx={(grid.width - padding * 2) / grid.columns / 2}
                                    cy={(grid.height - padding * 2) / grid.rows / 2}
                                    r={Math.max(
                                        0.45,
                                        (Math.min(
                                            (grid.width - padding * 2) / grid.columns,
                                            (grid.height - padding * 2) / grid.rows
                                        ) *
                                            clamp(dotScale, 0.08, 1)) /
                                            2
                                    )}
                                    fill={inactiveColor}
                                    opacity={clamp(inactiveOpacity)}
                                />
                            )}
                        </pattern>
                    </defs>
                    {renderStyle === "gradient" ? (
                        <g
                            mask={`url(#image-mask-${instanceId})`}
                            style={{
                                filter:
                                    glow > 0
                                        ? `drop-shadow(0 0 ${glow}px ${gradientColor3})`
                                        : "none",
                            }}
                        >
                            <rect
                                width={grid.width}
                                height={grid.height}
                                fill={`url(#spectrum-${instanceId})`}
                            />
                            {shimmer && (
                                <rect
                                    width={grid.width}
                                    height={grid.height}
                                    fill={`url(#spectrum-shimmer-${instanceId})`}
                                />
                            )}
                        </g>
                    ) : (
                        <>
                            <rect
                                x={padding}
                                y={padding}
                                width={Math.max(0, grid.width - padding * 2)}
                                height={Math.max(0, grid.height - padding * 2)}
                                fill={`url(#idle-${instanceId})`}
                            />
                            <g
                                style={{
                                    filter:
                                        glow > 0
                                            ? `drop-shadow(0 0 ${glow}px ${
                                                  matrixColorMode === "gradient"
                                                      ? gradientColor3
                                                      : activeColor
                                              })`
                                            : "none",
                                }}
                            >
                                {dots}
                            </g>
                        </>
                    )}
                </svg>
            )}
            {error && (
                <div
                    style={{
                        position: "absolute",
                        inset: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(255,255,255,0.62)",
                        font: "12px/1.35 Inter, sans-serif",
                        textAlign: "center",
                        pointerEvents: "none",
                    }}
                >
                    {error}
                </div>
            )}
        </div>
    )
}

addPropertyControls(DottedIcon, {
    source: {
        type: ControlType.File,
        title: "PNG / SVG",
        allowedFileTypes: [".png", ".svg", "image/png", "image/svg+xml"],
    },
    fit: {
        type: ControlType.Enum,
        title: "Fit",
        options: ["contain", "cover", "stretch"],
        optionTitles: ["Contain", "Cover", "Stretch"],
        defaultValue: "contain",
        displaySegmentedControl: true,
    },
    renderStyle: {
        type: ControlType.Enum,
        title: "Style",
        options: ["dots", "pixels", "gradient"],
        optionTitles: ["Dots", "Pixels", "Gradient"],
        defaultValue: "dots",
        displaySegmentedControl: true,
    },
    matrixColorMode: {
        type: ControlType.Enum,
        title: "Color",
        options: ["solid", "gradient"],
        optionTitles: ["Solid", "Gradient"],
        defaultValue: "solid",
        displaySegmentedControl: true,
        hidden: ({ renderStyle }: any) => renderStyle === "gradient",
    },
    columns: {
        type: ControlType.Number,
        title: "Density",
        defaultValue: 24,
        min: 6,
        max: 80,
        step: 1,
        displayStepper: true,
        hidden: ({ renderStyle }: any) => renderStyle === "gradient",
    },
    dotScale: {
        type: ControlType.Number,
        title: "Dot Size",
        defaultValue: 0.62,
        min: 0.08,
        max: 1,
        step: 0.01,
        hidden: ({ renderStyle }: any) => renderStyle !== "dots",
    },
    pixelScale: {
        type: ControlType.Number,
        title: "Pixel Size",
        defaultValue: 0.92,
        min: 0.1,
        max: 1,
        step: 0.01,
        hidden: ({ renderStyle }: any) => renderStyle !== "pixels",
    },
    pixelRadius: {
        type: ControlType.Number,
        title: "Pixel Radius",
        defaultValue: 0,
        min: 0,
        max: 0.5,
        step: 0.01,
        hidden: ({ renderStyle }: any) => renderStyle !== "pixels",
    },
    gradientColor1: {
        type: ControlType.Color,
        title: "Gradient 1",
        defaultValue: "#00E5FF",
        hidden: ({ renderStyle, matrixColorMode }: any) =>
            renderStyle !== "gradient" && matrixColorMode !== "gradient",
    },
    gradientColor2: {
        type: ControlType.Color,
        title: "Gradient 2",
        defaultValue: "#315CFF",
        hidden: ({ renderStyle, matrixColorMode }: any) =>
            renderStyle !== "gradient" && matrixColorMode !== "gradient",
    },
    gradientColor3: {
        type: ControlType.Color,
        title: "Gradient 3",
        defaultValue: "#A83CFF",
        hidden: ({ renderStyle, matrixColorMode }: any) =>
            renderStyle !== "gradient" && matrixColorMode !== "gradient",
    },
    gradientColor4: {
        type: ControlType.Color,
        title: "Gradient 4",
        defaultValue: "#FF5F9E",
        hidden: ({ renderStyle, matrixColorMode }: any) =>
            renderStyle !== "gradient" && matrixColorMode !== "gradient",
    },
    gradientColor5: {
        type: ControlType.Color,
        title: "Gradient 5",
        defaultValue: "#FFE14A",
        hidden: ({ renderStyle, matrixColorMode }: any) =>
            renderStyle !== "gradient" && matrixColorMode !== "gradient",
    },
    gradientAngle: {
        type: ControlType.Number,
        title: "Gradient Angle",
        defaultValue: 25,
        min: -180,
        max: 180,
        step: 1,
        unit: "°",
        hidden: ({ renderStyle, matrixColorMode }: any) =>
            renderStyle !== "gradient" && matrixColorMode !== "gradient",
    },
    detection: {
        type: ControlType.Enum,
        title: "Detect",
        options: ["alpha", "dark", "light"],
        optionTitles: ["Alpha", "Dark", "Light"],
        defaultValue: "alpha",
        description:
            "Alpha is best for transparent icons. Dark/Light work with opaque artwork.",
        hidden: ({ renderStyle }: any) => renderStyle === "gradient",
    },
    threshold: {
        type: ControlType.Number,
        title: "Threshold",
        defaultValue: 0.16,
        min: 0,
        max: 0.95,
        step: 0.01,
        hidden: ({ renderStyle }: any) => renderStyle === "gradient",
    },
    invert: {
        type: ControlType.Boolean,
        title: "Invert",
        defaultValue: false,
        hidden: ({ renderStyle }: any) => renderStyle === "gradient",
    },
    activeColor: {
        type: ControlType.Color,
        title: "Active",
        defaultValue: "#FFFFFF",
        hidden: ({ renderStyle, matrixColorMode }: any) =>
            renderStyle === "gradient" || matrixColorMode === "gradient",
    },
    inactiveColor: {
        type: ControlType.Color,
        title: "Inactive",
        defaultValue: "#66717A",
        hidden: ({ renderStyle }: any) => renderStyle === "gradient",
    },
    inactiveOpacity: {
        type: ControlType.Number,
        title: "Idle Opacity",
        defaultValue: 0.16,
        min: 0,
        max: 1,
        step: 0.01,
        hidden: ({ renderStyle }: any) => renderStyle === "gradient",
    },
    glow: {
        type: ControlType.Number,
        title: "Glow",
        defaultValue: 8,
        min: 0,
        max: 30,
        step: 1,
        unit: "px",
    },
    shimmer: {
        type: ControlType.Boolean,
        title: "Shimmer",
        defaultValue: true,
    },
    shimmerColor: {
        type: ControlType.Color,
        title: "Shimmer Color",
        defaultValue: "#BCEBFF",
        hidden: ({ shimmer }: any) => !shimmer,
    },
    shimmerIntensity: {
        type: ControlType.Number,
        title: "Intensity",
        defaultValue: 0.9,
        min: 0,
        max: 1,
        step: 0.01,
        hidden: ({ shimmer }: any) => !shimmer,
    },
    shimmerWidth: {
        type: ControlType.Number,
        title: "Band Width",
        defaultValue: 0.2,
        min: 0.02,
        max: 0.7,
        step: 0.01,
        hidden: ({ shimmer }: any) => !shimmer,
    },
    shimmerDuration: {
        type: ControlType.Number,
        title: "Duration",
        defaultValue: 1.8,
        min: 0.2,
        max: 10,
        step: 0.1,
        unit: "s",
        hidden: ({ shimmer }: any) => !shimmer,
    },
    shimmerAngle: {
        type: ControlType.Number,
        title: "Angle",
        defaultValue: 20,
        min: -180,
        max: 180,
        step: 1,
        unit: "°",
        hidden: ({ shimmer }: any) => !shimmer,
    },
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#050708",
    },
    radius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 16,
        min: 0,
        max: 100,
        step: 1,
        unit: "px",
    },
    padding: {
        type: ControlType.Number,
        title: "Padding",
        defaultValue: 16,
        min: 0,
        max: 80,
        step: 1,
        unit: "px",
    },
    ariaLabel: {
        type: ControlType.String,
        title: "Alt Text",
        defaultValue: "Dotted icon",
    },
})

DottedIcon.displayName = "Dotted Icon"
