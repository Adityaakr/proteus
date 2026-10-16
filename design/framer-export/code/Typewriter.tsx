import { useState, useEffect, useCallback, startTransition } from "react"
import { addPropertyControls, ControlType } from "framer"

interface TypewriterProps {
    text1: string
    text2: string
    text3: string
    typingSpeed: number
    pauseDuration: number
    textColor: string
    font: any
    cursorColor: string
    showCursor: boolean
    cursorBlinkSpeed: number
}

/**
 * Typewriter Text Animation
 * Cycles through 3 text inputs with typewriter effect, pausing 2 seconds after each completion.
 *
 * @framerIntrinsicWidth 300
 * @framerIntrinsicHeight 60
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function Typewriter(props: TypewriterProps) {
    const {
        text1 = "Welcome to my website",
        text2 = "I create amazing designs",
        text3 = "Let's work together",
        typingSpeed = 100,
        pauseDuration = 2000,
        textColor = "#000000",
        font,
        cursorColor = "#000000",
        showCursor = true,
        cursorBlinkSpeed = 530,
    } = props

    const texts = [text1, text2, text3]
    const [currentIndex, setCurrentIndex] = useState(0)
    const [currentText, setCurrentText] = useState("")
    const [isTyping, setIsTyping] = useState(true)
    const [isPaused, setIsPaused] = useState(false)
    const [cursorVisible, setCursorVisible] = useState(true)

    // Cursor blink effect
    useEffect(() => {
        if (!showCursor) return
        const interval = setInterval(() => {
            startTransition(() => setCursorVisible((v) => !v))
        }, cursorBlinkSpeed)
        return () => clearInterval(interval)
    }, [showCursor, cursorBlinkSpeed])

    // Typewriter effect
    useEffect(() => {
        const targetText = texts[currentIndex]

        if (isTyping && !isPaused) {
            if (currentText.length < targetText.length) {
                const timeout = setTimeout(() => {
                    startTransition(() => {
                        setCurrentText(targetText.slice(0, currentText.length + 1))
                    })
                }, typingSpeed)
                return () => clearTimeout(timeout)
            } else {
                // Finished typing, start pause
                startTransition(() => setIsPaused(true))
            }
        } else if (isPaused) {
            // Pause completed, move to next text
            const timeout = setTimeout(() => {
                startTransition(() => {
                    setIsPaused(false)
                    setIsTyping(false)
                    setCurrentText("")
                    setCurrentIndex((prev) => (prev + 1) % texts.length)
                })
            }, pauseDuration)
            return () => clearTimeout(timeout)
        } else if (!isTyping) {
            // Start typing next text
            startTransition(() => setIsTyping(true))
        }
    }, [currentText, currentIndex, isTyping, isPaused, texts, typingSpeed, pauseDuration])

    const containerStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        width: "100%",
        height: "100%",
        minWidth: "max-content",
    }

    const textStyle = {
        color: textColor,
        fontFamily: font?.fontFamily,
        fontSize: font?.fontSize,
        fontWeight: font?.fontWeight,
        fontStyle: font?.fontStyle,
        letterSpacing: font?.letterSpacing,
        lineHeight: font?.lineHeight,
        textAlign: font?.textAlign,
    }

    const cursorStyle = {
        display: "inline-block",
        width: "2px",
        height: "1em",
        backgroundColor: cursorColor,
        marginLeft: "2px",
        verticalAlign: "baseline",
        opacity: cursorVisible ? 1 : 0,
        transition: "opacity 0.1s ease",
    }

    return (
        <div style={containerStyle}>
            <span style={textStyle}>
                {currentText}
                {showCursor && <span style={cursorStyle} />}
            </span>
        </div>
    )
}

addPropertyControls(Typewriter, {
    text1: {
        type: ControlType.String,
        title: "Text 1",
        defaultValue: "Welcome to my website",
        placeholder: "First text to type...",
    },
    text2: {
        type: ControlType.String,
        title: "Text 2",
        defaultValue: "I create amazing designs",
        placeholder: "Second text to type...",
    },
    text3: {
        type: ControlType.String,
        title: "Text 3",
        defaultValue: "Let's work together",
        placeholder: "Third text to type...",
    },
    typingSpeed: {
        type: ControlType.Number,
        title: "Typing Speed",
        defaultValue: 100,
        min: 20,
        max: 500,
        step: 10,
        unit: "ms",
    },
    pauseDuration: {
        type: ControlType.Number,
        title: "Pause Duration",
        defaultValue: 2000,
        min: 500,
        max: 10000,
        step: 100,
        unit: "ms",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#000000",
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: "24px",
            variant: "Regular",
            letterSpacing: "0em",
            lineHeight: "1.2em",
            textAlign: "left",
        },
    },
    showCursor: {
        type: ControlType.Boolean,
        title: "Show Cursor",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    cursorColor: {
        type: ControlType.Color,
        title: "Cursor Color",
        defaultValue: "#000000",
        hidden: ({ showCursor }) => !showCursor,
    },
    cursorBlinkSpeed: {
        type: ControlType.Number,
        title: "Cursor Blink",
        defaultValue: 530,
        min: 100,
        max: 2000,
        step: 50,
        unit: "ms",
        hidden: ({ showCursor }) => !showCursor,
    },
})