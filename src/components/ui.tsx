"use client";

import {
  ArrowLeftRight,
  Briefcase,
  Car,
  ChartColumn,
  Clapperboard,
  CreditCard,
  Ellipsis,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  LayoutDashboard,
  PawPrint,
  Percent,
  PiggyBank,
  Plane,
  Plus,
  Repeat,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Utensils,
  Wallet,
  WalletCards,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { fmt, parseAmount, toInput } from "@/lib/money";
import { nextSection, sectionFor } from "@/lib/nav";
import type { Currency, Money as Cents } from "@/lib/types";

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ */
/* Iconos                                                              */
/* ------------------------------------------------------------------ */

export const ICONS: Record<string, LucideIcon> = {
  home: Home,
  cart: ShoppingCart,
  zap: Zap,
  car: Car,
  heart: HeartPulse,
  school: GraduationCap,
  shield: Shield,
  percent: Percent,
  utensils: Utensils,
  film: Clapperboard,
  repeat: Repeat,
  bag: ShoppingBag,
  plane: Plane,
  sparkles: Sparkles,
  gift: Gift,
  paw: PawPrint,
  dots: Ellipsis,
  briefcase: Briefcase,
  laptop: Laptop,
  trending: TrendingUp,
  plus: Plus,
  transfer: ArrowLeftRight,
  panel: LayoutDashboard,
  budget: WalletCards,
  target: Target,
  wallet: Wallet,
  card: CreditCard,
  chart: ChartColumn,
  settings: Settings,
  bank: Landmark,
  piggy: PiggyBank,
  loan: HandCoins,
};

export const CATEGORY_ICONS = [
  "home", "cart", "zap", "car", "heart", "school", "shield", "percent",
  "utensils", "film", "repeat", "bag", "plane", "sparkles", "gift", "paw",
  "briefcase", "laptop", "trending", "dots",
];

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="3.5" />
      <path d="M21.5 10.5 18 18l-7.5 3.5L14 14l7.5-3.5Z" fill="currentColor" />
    </svg>
  );
}

export function Icon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Ellipsis;
  return <I className={className} aria-hidden="true" />;
}

export function Bullet({
  tone,
  hue,
  icon,
  size,
  children,
  className,
}: {
  tone?: string;
  hue?: number;
  icon?: string;
  size?: "sm" | "lg";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "bullet",
        size === "sm" && "bullet-sm",
        size === "lg" && "bullet-lg",
        className,
      )}
      data-tone={tone}
      data-hue={hue}
      aria-hidden="true"
    >
      {icon ? <Icon name={icon} /> : children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Botones                                                             */
/* ------------------------------------------------------------------ */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "icon";
};

export function Button({ variant = "default", size, className, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cx(
        "btn",
        variant === "primary" && "btn-primary",
        variant === "ghost" && "btn-ghost",
        variant === "danger" && "btn-danger",
        size === "sm" && "btn-sm",
        size === "icon" && "btn-icon",
        className,
      )}
      {...rest}
    />
  );
}

/** Borrado en dos pasos, sin diálogo: el segundo clic confirma. */
export function ConfirmButton({
  label,
  confirmLabel = "Sí, borrar",
  onConfirm,
  size,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  size?: "sm";
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <Button variant="danger" size={size} onClick={onConfirm} autoFocus>
      {confirmLabel}
    </Button>
  ) : (
    <Button variant="ghost" size={size} onClick={() => setArmed(true)}>
      {label}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Campos                                                              */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("field", className)}>
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="hint">{hint}</span>
      ) : null}
    </label>
  );
}

const SYMBOL: Record<Currency, string> = { CRC: "₡", USD: "$" };

export function MoneyInput({
  value,
  onChange,
  currency,
  large,
  autoFocus,
  invalid,
  placeholder = "0",
}: {
  value: Cents;
  onChange: (cents: Cents) => void;
  currency: Currency;
  large?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(value ? toInput(value, currency) : "");
  return (
    <span className={cx("money-input", large && "money-lg")}>
      <span aria-hidden="true">{SYMBOL[currency]}</span>
      <input
        className="input"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        data-autofocus={autoFocus ? "" : undefined}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(Math.abs(parseAmount(e.target.value) ?? 0));
        }}
      />
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const move = (dir: 1 | -1) => {
    const i = options.findIndex((o) => o.value === value);
    onChange(options[(i + dir + options.length) % options.length].value);
  };
  return (
    <div
      className="seg"
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cifras y progreso                                                   */
/* ------------------------------------------------------------------ */

export function Amount({
  amount,
  currency,
  sign,
  positive,
  className,
}: {
  amount: Cents;
  currency: Currency;
  sign?: boolean;
  /** Pinta de verde los ingresos. */
  positive?: boolean;
  className?: string;
}) {
  return (
    <span className={cx("amount", positive && amount > 0 && "amount-pos", className)}>
      {fmt(amount, currency, { sign })}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="stat" data-tone={tone}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

export function Track({
  value,
  label,
  tone,
  hue,
  pace,
  over,
}: {
  /** 0 a 1. */
  value: number;
  label: string;
  tone?: string;
  hue?: number;
  /** Marca de referencia 0 a 1 (por ejemplo, el avance del mes). */
  pace?: number;
  over?: boolean;
}) {
  const p = Math.max(0, Math.min(1, value || 0));
  const style = {
    "--p": `${(p * 100).toFixed(1)}%`,
    ...(pace != null ? { "--pace": `${(Math.max(0, Math.min(1, pace)) * 100).toFixed(1)}%` } : {}),
  } as CSSProperties;
  return (
    <div
      className="track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
      data-tone={tone}
      data-hue={hue}
      data-state={over ? "over" : undefined}
      style={style}
    >
      <div className="track-fill" />
      <div className="track-rest" />
      <span className="track-dot" />
      {pace != null ? <span className="track-pace" /> : null}
    </div>
  );
}

export function Chip({
  state,
  children,
}: {
  state?: "good" | "warn" | "bad";
  children: ReactNode;
}) {
  return (
    <span className="chip" data-state={state}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Estructura de página                                                */
/* ------------------------------------------------------------------ */

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  const section = sectionFor(usePathname());
  const peek = nextSection(section.href);
  return (
    <header className="pagehead">
      <div className="pagehead-main">
        <div className="pagehead-title">
          <Bullet tone={section.tone} icon={section.icon} size="lg" />
          <h1 className="h-page">
            {title}
            <span className="peek" aria-hidden="true">
              {peek.label}
            </span>
          </h1>
        </div>
        {sub ? <p className="pagehead-sub">{sub}</p> : null}
      </div>
      {actions ? <div className="pagehead-actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("panel", className)}>
      {title ? (
        <div className="panel-head">
          <h2 className="h-section">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      <p className="muted">{body}</p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hoja lateral sobre <dialog>                                         */
/* ------------------------------------------------------------------ */

/** Conserva el último valor un instante después de quedar en null (animación de salida). */
export function useLinger<T>(value: T | null, ms = 300): T | null {
  const [kept, setKept] = useState(value);
  // Ajuste durante el render: recuerda el valor nuevo sin esperar a un efecto.
  if (value != null && value !== kept) setKept(value);
  useEffect(() => {
    if (value != null) return;
    const t = setTimeout(() => setKept(null), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return value ?? kept;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal enfoca el botón de cerrar; el foco debe ir al primer campo útil.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="sheet-body">
        <div className="sheet-head">
          <h2 className="sheet-title" id={titleId}>
            {title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X />
          </Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** Hoja cuyo contenido depende de un valor: abierta mientras el valor no sea null. */
export function FormSheet<T>({
  value,
  onClose,
  title,
  children,
}: {
  value: T | null;
  onClose: () => void;
  title: (v: T) => string;
  children: (v: T) => ReactNode;
}) {
  const shown = useLinger(value);
  return (
    <Sheet open={value != null} onClose={onClose} title={shown != null ? title(shown) : ""}>
      {shown != null ? children(shown) : null}
    </Sheet>
  );
}

export function SheetForm({
  onSubmit,
  footer,
  children,
}: {
  onSubmit: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <form
      className="sheet-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="sheet-content">{children}</div>
      <div className="sheet-foot">{footer}</div>
    </form>
  );
}
