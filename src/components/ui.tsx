import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon, type IconName } from './Icon';

/* ---------------- Layout ---------------- */

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  label,
  actions,
  children,
  className = '',
  as: Tag = 'section',
}: {
  title?: ReactNode;
  label?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'div';
}) {
  return (
    <Tag className={`card ${className}`}>
      {(title || label || actions) && (
        <div className="card__head">
          <div>
            {label && <p className="mono-label">{label}</p>}
            {title && <h2 className="card__title">{title}</h2>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children && <p className="empty__body">{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

export function Principle({ children }: { children: ReactNode }) {
  return <p className="principle">{children}</p>;
}

/* ---------------- Buttons ---------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  icon,
  children,
  size,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: IconName; size?: 'sm' }) {
  return (
    <button type="button" className={`btn btn--${variant}${size ? ` btn--${size}` : ''}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 16} />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = 'secondary',
  icon,
  children,
  external,
  size,
}: {
  href: string;
  variant?: ButtonVariant;
  icon?: IconName;
  children: ReactNode;
  external?: boolean;
  size?: 'sm';
}) {
  return (
    <a
      className={`btn btn--${variant}${size ? ` btn--${size}` : ''}`}
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 16} />}
      {children}
      {external && <span className="visually-hidden"> (opens in a new tab)</span>}
    </a>
  );
}

/* ---------------- Form fields ---------------- */

interface FieldBase {
  label: string;
  hint?: ReactNode;
  className?: string;
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  placeholder,
  className = '',
  inputMode,
  required,
  autoFocus,
}: FieldBase & {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'url' | 'date' | 'number' | 'email' | 'search';
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  required?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        required={required}
        autoFocus={autoFocus}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
      {hint && <p className="field__hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}

export function TextArea({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 3,
  className = '',
  autoFocus,
}: FieldBase & { value: string; onChange: (value: string) => void; placeholder?: string; rows?: number; autoFocus?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  // Grow with content so long reflections never hide behind a scrollbar.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + 2}px`;
  }, [value]);
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={event => onChange(event.target.value)}
      />
      {hint && <p className="field__hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
  className = '',
}: FieldBase & { value: T; onChange: (value: T) => void; options: { value: T; label: string }[] }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={event => onChange(event.target.value as T)} aria-describedby={hint ? `${id}-hint` : undefined}>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className="field__hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}

/** Number input that keeps what you type and reports null for empty/invalid. */
export function NumberField({
  label,
  hint,
  value,
  onChange,
  prefix,
  suffix,
  className = '',
  min,
  step,
}: FieldBase & { value: number | null; onChange: (value: number | null) => void; prefix?: string; suffix?: string; min?: number; step?: number }) {
  const id = useId();
  const [text, setText] = useState(value === null ? '' : String(value));
  // Resync only when the stored value changes from outside (e.g. reset), not while typing.
  useEffect(() => {
    setText(current => {
      const cleaned = current.replace(/[,\s₹]/g, '');
      const parsed = cleaned === '' ? null : Number(cleaned);
      return parsed === value ? current : value === null ? '' : String(value);
    });
  }, [value]);
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="affix">
        {prefix && <span className="affix__part" aria-hidden="true">{prefix}</span>}
        <input
          id={id}
          inputMode="decimal"
          value={text}
          min={min}
          step={step}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={event => {
            const raw = event.target.value;
            setText(raw);
            const cleaned = raw.replace(/[,\s₹]/g, '');
            if (cleaned === '') onChange(null);
            else if (Number.isFinite(Number(cleaned)) && Number(cleaned) >= (min ?? 0)) onChange(Number(cleaned));
          }}
        />
        {suffix && <span className="affix__part" aria-hidden="true">{suffix}</span>}
      </div>
      {hint && <p className="field__hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  className = '',
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`check ${checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
      <span className="check__box" aria-hidden="true">
        <Icon name="check" size={13} />
      </span>
      <span className="check__label">{children}</span>
    </label>
  );
}

/** Free-text tags: type and press Enter or comma. */
export function TagInput({ label, value, onChange, placeholder, hint }: FieldBase & { value: string[]; onChange: (tags: string[]) => void; placeholder?: string }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const commit = () => {
    const tag = draft.trim().replace(/,$/, '');
    if (tag && !value.some(existing => existing.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="tag-input">
        {value.map(tag => (
          <span className="chip" key={tag}>
            {tag}
            <button type="button" className="chip__remove" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter(item => item !== tag))}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
        <input id={id} value={draft} placeholder={value.length ? '' : placeholder} onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown} onBlur={commit} />
      </div>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

/** A row of mutually exclusive options (radio group semantics). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend className={hideLabel ? 'visually-hidden' : 'mono-label'}>{label}</legend>
      <div className="segmented__options">
        {options.map(option => (
          <label key={option.value} className={`segmented__option ${value === option.value ? 'is-active' : ''}`}>
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
            <span>{option.label}</span>
            {option.count !== undefined && <span className="segmented__count">{option.count}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ---------------- Status & progress ---------------- */

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'muted';

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

export function ProgressBar({ value, label, tone = 'accent' }: { value: number; label: string; tone?: 'accent' | 'ink' }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={`progress progress--${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span className="progress__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Discrete maturity meter: filled segments out of `max`. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span className="meter" role="img" aria-label={`${label}: ${value} of ${max}`}>
      {Array.from({ length: max }, (_, index) => (
        <span key={index} className={`meter__seg ${index < value ? 'is-on' : ''}`} />
      ))}
    </span>
  );
}

export function Metric({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="metric">
      <p className="mono-label">{label}</p>
      <p className="metric__value">{value}</p>
      {detail && <p className="metric__detail">{detail}</p>}
    </div>
  );
}

/* ---------------- Dialogs ---------------- */

/**
 * Native <dialog> modal: focus is trapped, Esc closes, focus returns to the opener.
 * Mount it only while open.
 */
export function Dialog({
  title,
  onClose,
  children,
  footer,
  size = 'md',
  description,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  description?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      opener?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${size}`}
      aria-labelledby={titleId}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={event => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog__inner">
        <header className="dialog__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {description && <div className="dialog__description">{description}</div>}
        <div className="dialog__body">{children}</div>
        {footer && <footer className="dialog__foot">{footer}</footer>}
      </div>
    </dialog>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      title={title}
      size="sm"
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="prose">{body}</div>
    </Dialog>
  );
}

/* ---------------- Misc ---------------- */

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="ext-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <Icon name="external" size={13} />
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

export function KeyHint({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
