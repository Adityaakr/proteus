import { forwardRef, type MouseEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { T_DEFAULT } from "../../lib/motion";
import s from "./ui.module.css";

/**
 * ActionButton: the app's button, matching the marketing Button.tsx look (pill, inset 1px border,
 * spring background fade on hover). Renders a <button>, a router <Link> (`to`) or an <a> (`href`).
 */
export type ActionButtonVariant = "primary" | "secondary" | "light" | "ghost" | "danger";
export type ActionButtonSize = "sm" | "md" | "lg";

export interface ActionButtonProps {
  children: ReactNode;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  /** Router path: renders a react-router Link. */
  to?: string;
  /** External URL: renders an <a> (opens in a new tab when `newTab`). */
  href?: string;
  newTab?: boolean;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  type?: "button" | "submit" | "reset";
  /** Shows a spinner, sets aria-busy and blocks clicks. */
  loading?: boolean;
  /** Label announced while loading (defaults to children). */
  loadingLabel?: ReactNode;
  disabled?: boolean;
  /** Trailing icon. `true` shows the arrow, a node replaces it. Default false. */
  icon?: ReactNode | boolean;
  /** Leading icon. */
  iconLeft?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  form?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-controls"?: string;
  "aria-expanded"?: boolean;
}

const fills: Record<ActionButtonVariant, { rest: string; hover: string }> = {
  primary: { rest: "rgb(1, 43, 255)", hover: "rgb(2, 37, 212)" },
  light: { rest: "rgb(9, 174, 255)", hover: "rgb(9, 153, 224)" },
  secondary: { rest: "rgba(0, 0, 0, 0)", hover: "rgba(0, 0, 0, 0.04)" },
  ghost: { rest: "rgba(0, 0, 0, 0)", hover: "rgba(0, 0, 0, 0.05)" },
  danger: { rest: "rgba(214, 40, 40, 0)", hover: "rgba(214, 40, 40, 0.06)" },
};

const MotionLink = motion.create(Link);

export const ActionButton = forwardRef<HTMLElement, ActionButtonProps>(function ActionButton(
  {
    children,
    variant = "primary",
    size = "md",
    to,
    href,
    newTab,
    onClick,
    type = "button",
    loading,
    loadingLabel,
    disabled,
    icon = false,
    iconLeft,
    fullWidth,
    className,
    form,
    ...aria
  },
  ref,
) {
  const inactive = Boolean(disabled || loading);
  const cls = [s.btn, s[`btn_${size}`], s[`btn_${variant}`], fullWidth ? s.btn_full : "", className ?? ""].filter(Boolean).join(" ");
  const trailing = icon === true ? <ArrowRight size={16} strokeWidth={2} /> : icon || null;
  const content = (
    <>
      {loading ? (
        <span className={s.btnIcon} aria-hidden>
          <LoaderCircle size={16} strokeWidth={2} className={s.spin} />
        </span>
      ) : iconLeft ? (
        <span className={s.btnIcon} aria-hidden>
          {iconLeft}
        </span>
      ) : null}
      <span className={s.btnLabel}>{loading && loadingLabel ? loadingLabel : children}</span>
      {trailing && !loading ? (
        <span className={s.btnIcon} aria-hidden>
          {trailing}
        </span>
      ) : null}
    </>
  );
  const motionProps = {
    initial: false as const,
    animate: { backgroundColor: fills[variant].rest },
    whileHover: inactive ? undefined : { backgroundColor: fills[variant].hover },
    whileTap: inactive ? undefined : { scale: 0.98 },
    transition: T_DEFAULT,
  };
  const guard = (e: MouseEvent<HTMLElement>) => {
    if (inactive) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  if (to && !inactive) {
    return (
      <MotionLink ref={ref as never} to={to} className={cls} onClick={guard} {...motionProps} {...aria}>
        {content}
      </MotionLink>
    );
  }
  if (href && !inactive) {
    return (
      <motion.a
        ref={ref as never}
        href={href}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noreferrer" : undefined}
        className={cls}
        onClick={guard}
        {...motionProps}
        {...aria}
      >
        {content}
      </motion.a>
    );
  }
  return (
    <motion.button
      ref={ref as never}
      type={type}
      form={form}
      className={cls}
      onClick={guard}
      disabled={disabled}
      aria-disabled={inactive || undefined}
      aria-busy={loading || undefined}
      {...motionProps}
      {...aria}
    >
      {content}
    </motion.button>
  );
});
