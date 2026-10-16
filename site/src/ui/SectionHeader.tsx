import type { CSSProperties, ReactNode } from "react";
import { Tag } from "./Tag";

/**
 * The "Heading + tag" block every section starts with: Tag, then Heading 2 and a Body 1
 * description. Pass the gaps / maxWidths from the section's export (defaults are the
 * most common values: gap 24 between tag and text, 16 between heading and description).
 */
export interface SectionHeaderProps {
  tag: string;
  heading: string;
  description?: string;
  align?: "center" | "left";
  dark?: boolean;
  icon?: ReactNode;
  gap?: number;
  textGap?: number;
  headingMaxWidth?: number | string;
  descriptionMaxWidth?: number | string;
  style?: CSSProperties;
  className?: string;
}

export function SectionHeader({ tag, heading, description, align = "center", dark, icon, gap = 24, textGap = 16, headingMaxWidth = 600, descriptionMaxWidth = 500, style, className }: SectionHeaderProps) {
  const isCenter = align === "center";
  return (
    <div
      className={className}
      style={{ display: "flex", flexDirection: "column", alignItems: isCenter ? "center" : "flex-start", gap, width: "100%", ...style }}
    >
      <Tag title={tag} icon={icon} dark={dark} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: isCenter ? "center" : "flex-start", gap: textGap, width: "100%" }}>
        <h2 className="h2" style={{ maxWidth: headingMaxWidth, textAlign: isCenter ? "center" : "left", color: dark ? "var(--c-white)" : "var(--c-dark)" }}>
          {heading}
        </h2>
        {description && (
          <p className="body1" style={{ maxWidth: descriptionMaxWidth, textAlign: isCenter ? "center" : "left", color: dark ? "var(--c-white-80)" : "var(--c-body)" }}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
