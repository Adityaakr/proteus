import { startTransition, useEffect, useRef, useState, type CSSProperties } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "../lib/framer-shim"
import { motion, useReducedMotion } from "framer-motion"

interface TestimonialItem {
    quote: string
    name: string
    role: string
    company: string
    initials: string
    portrait?: NavigationImage | string
    /** Keeps existing URL-based entries working after the uploader migration. */
    photo?: NavigationImage | string
}

interface CarouselItem extends TestimonialItem {
    instanceId: string
}

interface NavigationImage {
    src: string
    alt?: string
}

/** Site heading font (Satoshi stands in for PP Neue Montreal, see styles/tokens.css). */
const FONT = "var(--font-heading)"

function getImageSrc(image?: NavigationImage | string) {
    return typeof image === "string" ? image : image?.src
}

interface StaggerTestimonialsProps {
    testimonials: TestimonialItem[]
    autoplay: boolean
    pauseOnHover: boolean
    interval: number
    surface: string
    inactiveCard: string
    activeCard: string
    borderColor: string
    accent: string
    inactiveText: string
    activeText: string
    mutedText: string
    cardWidth: number
    cardHeight: number
    cardGap: number
    activeLift: number
    cardRadius: string
    previousImage?: NavigationImage
    nextImage?: NavigationImage
    quoteFont: CSSProperties
    metaFont: CSSProperties
    style?: CSSProperties
}

const defaultTestimonials: TestimonialItem[] = [
    {
        quote: "Fantom gives our team one clear place to turn scattered customer signals into action.",
        name: "Maya Chen",
        role: "Chief Operating Officer",
        company: "Northstar",
        initials: "MC",
        portrait: { src: "https://i.pravatar.cc/160?img=47", alt: "Maya Chen" },
    },
    {
        quote: "We spend less time collecting updates and more time making the decisions that move work forward.",
        name: "Daniel Ross",
        role: "Head of Product",
        company: "Frame",
        initials: "DR",
        portrait: { src: "https://i.pravatar.cc/160?img=12", alt: "Daniel Ross" },
    },
    {
        quote: "It feels less like another tool and more like a dependable operator embedded in the team.",
        name: "Lina Ortiz",
        role: "VP, Customer Experience",
        company: "Relay",
        initials: "LO",
        portrait: { src: "https://i.pravatar.cc/160?img=32", alt: "Lina Ortiz" },
    },
    {
        quote: "Fantom helped us coordinate launches without adding another layer of meetings or reporting.",
        name: "Jordan Blake",
        role: "Chief Technology Officer",
        company: "Meridian",
        initials: "JB",
        portrait: { src: "https://i.pravatar.cc/160?img=11", alt: "Jordan Blake" },
    },
    {
        quote: "The system is calm, precise, and flexible enough to support how our people already work.",
        name: "Priya Shah",
        role: "Director of Operations",
        company: "Common Thread",
        initials: "PS",
        portrait: { src: "https://i.pravatar.cc/160?img=44", alt: "Priya Shah" },
    },
    {
        quote: "We launched in days, saw adoption immediately, and finally have an operating rhythm that scales.",
        name: "Eli Morgan",
        role: "Founder",
        company: "Current",
        initials: "EM",
        portrait: { src: "https://i.pravatar.cc/160?img=15", alt: "Eli Morgan" },
    },
    {
        quote: "Our information is easier to find, our handoffs are cleaner, and nothing important gets buried.",
        name: "Amara Lewis",
        role: "Program Lead",
        company: "Tandem",
        initials: "AL",
        portrait: { src: "https://i.pravatar.cc/160?img=49", alt: "Amara Lewis" },
    },
]

function Arrow({ direction }: { direction: "left" | "right" }) {
    return (
        <span
            aria-hidden="true"
            style={{
                width: 11,
                height: 11,
                borderTop: "1.5px solid currentColor",
                borderRight: "1.5px solid currentColor",
                transform: direction === "left" ? "rotate(-135deg)" : "rotate(45deg)",
            }}
        />
    )
}

/**
 * @framerIntrinsicWidth 1500
 * @framerIntrinsicHeight 700
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function StaggerTestimonials(props: StaggerTestimonialsProps) {
    const {
        testimonials = defaultTestimonials,
        autoplay = false,
        pauseOnHover = false,
        interval = 4200,
        surface = "#101010",
        inactiveCard = "#151515",
        activeCard = "#F4F4F1",
        borderColor = "rgba(255,255,255,0.12)",
        accent = "#315BFF",
        inactiveText = "#F4F4F1",
        activeText = "#111111",
        mutedText = "rgba(255,255,255,0.55)",
        cardWidth = 350,
        cardHeight = 390,
        cardGap = 235,
        activeLift = 58,
        cardRadius = "16px",
        previousImage,
        nextImage,
        quoteFont,
        metaFont,
    } = props

    const items = testimonials.length >= 3 ? testimonials : defaultTestimonials
    const testimonialSignature = items
        .map((item) => `${item.name}-${item.quote}-${getImageSrc(item.portrait ?? item.photo) || ""}`)
        .join("|")
    const rootRef = useRef<HTMLElement>(null)
    const instanceCounter = useRef(0)
    const createCarouselItems = (source: TestimonialItem[]): CarouselItem[] =>
        source.map((item, index) => ({
            ...item,
            instanceId: `${index}-${instanceCounter.current++}`,
        }))
    const [carouselItems, setCarouselItems] = useState<CarouselItem[]>(() =>
        createCarouselItems(items)
    )
    const [containerWidth, setContainerWidth] = useState(1500)
    const [paused, setPaused] = useState(false)
    const isStatic = useIsStaticRenderer()
    const reduceMotion = useReducedMotion()
    const compact = containerWidth < 720
    const medium = containerWidth < 1080
    const renderedCardWidth = compact
        ? Math.min(containerWidth - 48, 310)
        : medium
          ? Math.min(cardWidth, 320)
          : cardWidth
    const renderedCardHeight = compact ? Math.min(cardHeight, 360) : cardHeight
    const renderedGap = compact ? renderedCardWidth * 0.78 : medium ? cardGap * 0.82 : cardGap

    useEffect(() => {
        if (typeof window === "undefined" || !rootRef.current) return
        const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
        observer.observe(rootRef.current)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        setCarouselItems(createCarouselItems(items))
    }, [testimonialSignature])

    useEffect(() => {
        if (
            typeof window === "undefined" ||
            isStatic ||
            reduceMotion ||
            !autoplay ||
            (pauseOnHover && paused)
        )
            return
        const timer = window.setInterval(() => {
            move(1)
        }, Math.max(1600, interval))
        return () => window.clearInterval(timer)
    }, [autoplay, interval, isStatic, items.length, pauseOnHover, paused, reduceMotion])

    const move = (step: number) => {
        startTransition(() => {
            setCarouselItems((current) => {
                const next = [...current]
                const count = Math.abs(step)

                for (let index = 0; index < count; index += 1) {
                    if (step > 0) {
                        const first = next.shift()
                        if (first) {
                            next.push({
                                ...first,
                                instanceId: `${first.name}-${instanceCounter.current++}`,
                            })
                        }
                    } else {
                        const last = next.pop()
                        if (last) {
                            next.unshift({
                                ...last,
                                instanceId: `${last.name}-${instanceCounter.current++}`,
                            })
                        }
                    }
                }

                return next
            })
        })
    }

    const transition = reduceMotion
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 115, damping: 19, mass: 0.8 }

    return (
        <section
            ref={rootRef}
            aria-roledescription="carousel"
            aria-label="Customer testimonials"
            onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined}
            onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined}
            style={{
                ...props.style,
                position: "relative",
                width: "100%",
                height: "100%",
                minHeight: compact ? 560 : 620,
                overflow: "hidden",
                boxSizing: "border-box",
                background: surface,
                fontFamily: FONT,
                isolation: "isolate",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: "0 0 112px",
                    overflow: "hidden",
                }}
            >
                {carouselItems.map((item, index) => {
                    const position = index - Math.floor(carouselItems.length / 2)
                    const isActive = position === 0
                    const distance = Math.abs(position)
                    const visible = distance <= (compact ? 1 : medium ? 2 : 4)
                    const tilt = isActive ? 0 : position % 2 === 0 ? -2.15 : 2.15
                    const idleY = isActive ? -activeLift : position % 2 === 0 ? -10 : 12
                    const cardMuted = isActive ? "rgba(17,17,17,0.58)" : mutedText
                    const portraitSrc = getImageSrc(item.portrait ?? item.photo)

                    return (
                        <motion.article
                            key={item.instanceId}
                            role="group"
                            aria-roledescription="slide"
                            aria-label={`${index + 1} of ${carouselItems.length}`}
                            aria-hidden={!isActive}
                            onClick={() => move(position)}
                            initial={false}
                            animate={{
                                x: position * renderedGap,
                                y: idleY,
                                rotate: tilt,
                                scale: isActive ? 1 : Math.max(0.91, 0.985 - distance * 0.012),
                                opacity: visible ? 1 : 0,
                            }}
                            transition={transition}
                            style={{
                                position: "absolute",
                                left: "50%",
                                top: compact ? 112 : 124,
                                marginLeft: -renderedCardWidth / 2,
                                width: renderedCardWidth,
                                height: renderedCardHeight,
                                zIndex: 20 - distance,
                                boxSizing: "border-box",
                                padding: compact ? 26 : 32,
                                cursor: isActive ? "default" : "pointer",
                                pointerEvents: visible ? "auto" : "none",
                                borderRadius: cardRadius,
                                background: isActive ? activeCard : inactiveCard,
                                border: `1px solid ${isActive ? "rgba(17,17,17,0.10)" : borderColor}`,
                                boxShadow: "none",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                color: isActive ? activeText : inactiveText,
                                transformOrigin: "50% 100%",
                            }}
                        >
                            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 16,
                                    }}
                                >
                                    {portraitSrc ? (
                                        <img
                                            src={portraitSrc}
                                            alt=""
                                            loading="lazy"
                                            style={{
                                                width: 48,
                                                height: 48,
                                                objectFit: "contain",
                                                borderRadius: 11,
                                                opacity: isActive ? 1 : 0.7,
                                            }}
                                        />
                                    ) : (
                                        <span
                                            aria-hidden="true"
                                            style={{
                                                width: 48,
                                                height: 48,
                                                display: "grid",
                                                placeItems: "center",
                                                borderRadius: 4,
                                                background: accent,
                                                color: "white",
                                                fontSize: 13,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {item.initials}
                                        </span>
                                    )}
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 999,
                                            background: isActive ? accent : borderColor,
                                        }}
                                    />
                                </div>
                                <blockquote
                                    style={{
                                        margin: 0,
                                        fontSize: compact ? 25 : 27,
                                        fontWeight: 500,
                                        lineHeight: 1.18,
                                        letterSpacing: "-0.025em",
                                        fontFamily: FONT,
                                        ...quoteFont,
                                    }}
                                >
                                    “{item.quote}”
                                </blockquote>
                            </div>
                            <p
                                style={{
                                    margin: 0,
                                    color: cardMuted,
                                    fontSize: 15,
                                    lineHeight: 1.35,
                                    fontStyle: "italic",
                                    fontFamily: FONT,
                                    ...metaFont,
                                }}
                            >
                                — {item.name}
                                {item.role ? `, ${item.role}` : ""}
                                {item.company ? ` · ${item.company}` : ""}
                            </p>
                        </motion.article>
                    )
                })}
            </div>

            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 28,
                    transform: "translateX(-50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    zIndex: 30,
                }}
            >
                {(["left", "right"] as const).map((direction) => (
                    <motion.button
                        key={direction}
                        type="button"
                        aria-label={direction === "left" ? "Previous testimonial" : "Next testimonial"}
                        onClick={() => move(direction === "left" ? -1 : 1)}
                        whileHover={reduceMotion ? undefined : { y: -2, backgroundColor: accent }}
                        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                        style={{
                            width: 52,
                            height: 52,
                            padding: 0,
                            border: `1px solid ${borderColor}`,
                            borderRadius: 0,
                            display: "grid",
                            placeItems: "center",
                            background: inactiveCard,
                            color: inactiveText,
                            cursor: "pointer",
                        }}
                    >
                        {(direction === "left" ? previousImage : nextImage)?.src ? (
                            <img
                                src={(direction === "left" ? previousImage : nextImage)?.src}
                                alt=""
                                style={{
                                    display: "block",
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                }}
                            />
                        ) : (
                            <Arrow direction={direction} />
                        )}
                    </motion.button>
                ))}
            </div>
        </section>
    )
}

addPropertyControls(StaggerTestimonials, {
    testimonials: {
        type: ControlType.Array,
        title: "Testimonials",
        maxCount: 12,
        control: {
            type: ControlType.Object,
            controls: {
                quote: {
                    type: ControlType.String,
                    title: "Quote",
                    defaultValue: "A clear customer outcome.",
                    displayTextArea: true,
                },
                name: { type: ControlType.String, title: "Name", defaultValue: "Customer name" },
                role: { type: ControlType.String, title: "Role", defaultValue: "Role" },
                company: { type: ControlType.String, title: "Company", defaultValue: "Company" },
                initials: { type: ControlType.String, title: "Initials", defaultValue: "CN" },
                portrait: { type: ControlType.ResponsiveImage, title: "Photo" },
            },
        },
        defaultValue: defaultTestimonials,
    },
    autoplay: { type: ControlType.Boolean, title: "Autoplay", defaultValue: false },
    pauseOnHover: {
        type: ControlType.Boolean,
        title: "Pause on Hover",
        defaultValue: false,
        hidden: ({ autoplay }: any) => !autoplay,
    },
    interval: {
        type: ControlType.Number,
        title: "Interval",
        defaultValue: 4200,
        min: 1600,
        max: 10000,
        step: 100,
        unit: "ms",
        hidden: ({ autoplay }: any) => !autoplay,
    },
    surface: { type: ControlType.Color, title: "Surface", defaultValue: "#101010" },
    inactiveCard: { type: ControlType.Color, title: "Back Cards", defaultValue: "#151515" },
    activeCard: { type: ControlType.Color, title: "Active Card", defaultValue: "#F4F4F1" },
    borderColor: {
        type: ControlType.Color,
        title: "Border",
        defaultValue: "rgba(255,255,255,0.12)",
    },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#315BFF" },
    inactiveText: { type: ControlType.Color, title: "Back Text", defaultValue: "#F4F4F1" },
    activeText: { type: ControlType.Color, title: "Active Text", defaultValue: "#111111" },
    mutedText: {
        type: ControlType.Color,
        title: "Muted Text",
        defaultValue: "rgba(255,255,255,0.55)",
    },
    cardWidth: {
        type: ControlType.Number,
        title: "Card Width",
        defaultValue: 350,
        min: 280,
        max: 460,
        step: 2,
        unit: "px",
    },
    cardHeight: {
        type: ControlType.Number,
        title: "Card Height",
        defaultValue: 390,
        min: 320,
        max: 520,
        step: 2,
        unit: "px",
    },
    cardGap: {
        type: ControlType.Number,
        title: "Card Gap",
        defaultValue: 235,
        min: 150,
        max: 360,
        step: 2,
        unit: "px",
    },
    activeLift: {
        type: ControlType.Number,
        title: "Active Lift",
        defaultValue: 58,
        min: 0,
        max: 110,
        step: 2,
        unit: "px",
    },
    cardRadius: {
        type: ControlType.BorderRadius,
        title: "Card Radius",
        defaultValue: "16px",
    },
    previousImage: {
        type: ControlType.ResponsiveImage,
        title: "Previous Image",
    },
    nextImage: {
        type: ControlType.ResponsiveImage,
        title: "Next Image",
    },
    quoteFont: {
        type: ControlType.Font,
        title: "Quote Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            variant: "Medium",
            fontSize: "27px",
            letterSpacing: "-0.025em",
            lineHeight: "1.18em",
        },
    },
    metaFont: {
        type: ControlType.Font,
        title: "Meta Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            variant: "Regular",
            fontSize: "15px",
            letterSpacing: "-0.01em",
            lineHeight: "1.35em",
        },
    },
})
