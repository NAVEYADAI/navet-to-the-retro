import React, { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui';
import { useTheme } from '@/design/theme-context';
import { Strings } from '@/constants/strings';
import { getNavStyles } from './app-tabs.styles';

export interface NavUserMenuItem {
  key: string;
  label: string;
  icon: IconName;
  danger?: boolean;
  onSelect: () => void;
}

interface Props {
  /** שם להצגה (שם פרטי, אחרת החלק שלפני ה-@ באימייל). */
  displayName: string;
  /** תפריט הפעולות. מוסיפים פריט חדש כאן — לא משנים את הקומפוננטה. */
  items: NavUserMenuItem[];
}

/** כפתור אווטאר + שם בסרגל הצף, שפותח תפריט פעולות. נסגר בלחיצה בחוץ, ב-Escape ואחרי בחירה. */
export function NavUserMenu({ displayName, items }: Props) {
  const t = useTheme();
  const s = getNavStyles(t);
  const [open, setOpen] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={Strings.nav.userMenuLabel}
        onClick={() => setOpen((v) => !v)}
        style={s.userTrigger(open)}
      >
        <span style={s.avatar}>{(displayName[0] || '?').toUpperCase()}</span>
        <span className="nav-user-text" style={s.userName}>{displayName}</span>
        <span className="nav-user-text" style={{ display: 'flex' }}>
          <Icon name="chevron-down" size="sm" tone="muted" rotate={open ? 180 : 0} />
        </span>
      </button>

      {open && (
        <div role="menu" aria-label={Strings.nav.userMenuLabel} style={s.menu}>
          <div style={s.menuHeader}>
            <span style={s.menuOverline}>{Strings.nav.signedInAs}</span>
            <span style={s.userName}>{displayName}</span>
          </div>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              style={s.menuItem(!!item.danger, hoveredKey === item.key)}
            >
              <Icon name={item.icon} size="md" tone={item.danger ? 'danger' : 'muted'} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
