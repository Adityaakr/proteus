import { createContext, useContext, useId, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import s from "./message.module.css";

/**
 * Message primitives, ported from beui's Message Bubble (MIT) into this app's CSS-module system.
 *  <MessageGroup spacing>                        a column of messages
 *    <Message from="user" | "assistant">         sets the side (end for user, start for assistant)
 *      <MessageAvatar placeholder?>              avatar column; placeholder keeps grouped follow-ups aligned
 *      <MessageContent>
 *        <MessageHeader>name, time</MessageHeader>
 *        <MessageBubble variant animateIn><MessageBubbleContent>…</MessageBubbleContent></MessageBubble>
 *        <MessageFooter>Delivered</MessageFooter>
 *  <MessageBubbleCollapsible collapsedLines>     clamps long content with Show more / Show less
 * animateIn plays the entrance exactly once on mount; later content changes never replay it.
 */
export type MessageSide = "start" | "end";
export type MessageBubbleVariant = "solid" | "soft" | "tint" | "outline" | "ghost" | "danger";

const SideContext = createContext<MessageSide>("start");
const BubbleContext = createContext<{ align: MessageSide; animateIn: boolean; variant: MessageBubbleVariant }>({ align: "start", animateIn: false, variant: "soft" });

const POP = { type: "spring", stiffness: 520, damping: 27, mass: 0.52 } as const;

export function MessageGroup({ spacing = "compact", className, children }: { spacing?: "compact" | "default"; className?: string; children?: ReactNode }) {
  return <div className={`${s.group} ${spacing === "default" ? s.groupDefault : ""} ${className ?? ""}`}>{children}</div>;
}

export function Message({ from, className, children }: { from: "user" | "assistant" | "system"; className?: string; children?: ReactNode }) {
  const side: MessageSide = from === "user" ? "end" : "start";
  return (
    <SideContext.Provider value={side}>
      <div className={`${s.message} ${from === "user" ? s.messageEnd : from === "system" ? s.messageSystem : ""} ${className ?? ""}`} data-from={from}>
        {children}
      </div>
    </SideContext.Provider>
  );
}

export function MessageAvatar({ placeholder, className, children }: { placeholder?: boolean; className?: string; children?: ReactNode }) {
  if (placeholder) return <span className={`${s.avatar} ${s.avatarPlaceholder}`} aria-hidden />;
  return <span className={`${s.avatar} ${className ?? ""}`} aria-hidden>{children}</span>;
}

export function MessageContent({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={`${s.content} ${className ?? ""}`}>{children}</div>;
}

export function MessageHeader({ children }: { children?: ReactNode }) {
  return <div className={s.header}>{children}</div>;
}

export function MessageFooter({ children }: { children?: ReactNode }) {
  return <div className={s.footer}>{children}</div>;
}

export function MessageBubble({ variant = "soft", align, animateIn = false, className, children }: { variant?: MessageBubbleVariant; align?: MessageSide; animateIn?: boolean; className?: string; children?: ReactNode }) {
  const side = useContext(SideContext);
  const resolved = align ?? side;
  return (
    <BubbleContext.Provider value={{ align: resolved, animateIn, variant }}>
      <div className={`${s.bubble} ${resolved === "end" ? s.bubbleEnd : ""} ${className ?? ""}`} data-variant={variant} data-align={resolved}>
        {children}
      </div>
    </BubbleContext.Provider>
  );
}

export function MessageBubbleContent({ className, style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  const reduce = useReducedMotion() ?? false;
  const { align, animateIn, variant } = useContext(BubbleContext);
  const variantClass = { solid: s.solid, soft: s.soft, tint: s.tint, outline: s.outline, ghost: s.ghost, danger: s.danger }[variant];
  return (
    <div className={`${s.bubbleContent} ${variantClass} ${className ?? ""}`} style={style}>
      {variant !== "ghost" && (
        <motion.span
          aria-hidden
          className={s.surface}
          style={{ transformOrigin: align === "end" ? "bottom right" : "bottom left" }}
          initial={animateIn && !reduce ? { opacity: 0, scale: 0.92 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={POP}
        />
      )}
      <motion.div className={s.inner} initial={animateIn && !reduce ? { opacity: 0, y: 3 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, delay: 0.04 }}>
        {children}
      </motion.div>
    </div>
  );
}

export function MessageBubbleCollapsible({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  collapsedLines = 4,
  moreLabel = "Show more",
  lessLabel = "Show less",
  className,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapsedLines?: 2 | 3 | 4 | 5 | 6;
  moreLabel?: ReactNode;
  lessLabel?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const open = openProp ?? own;
  const id = useId();
  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setOwn(next);
    onOpenChange?.(next);
  };
  return (
    <div className={`${s.collapsible} ${className ?? ""}`}>
      <div id={id} className={`${s.clamp} ${open ? s.clampOpen : ""}`} style={{ ["--lines" as string]: collapsedLines }}>
        {children}
      </div>
      <button type="button" className={s.toggle} onClick={toggle} aria-expanded={open} aria-controls={id}>
        <ChevronDown size={13} strokeWidth={2.25} aria-hidden style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 160ms ease" }} />
        {open ? lessLabel : moreLabel}
      </button>
    </div>
  );
}
