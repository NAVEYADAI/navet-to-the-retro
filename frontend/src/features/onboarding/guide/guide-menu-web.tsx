import React, { useRef, useState } from 'react';
import { Menu, MenuItem, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { useTour } from '../hooks/use-tour';
import { TourDialogWeb } from '../components/tour-web';
import { useGuide } from './guide-provider';
import type { GuideId } from './guide-types';

const G = Strings.onboarding.guide;

/**
 * The guide's entry point in the top bar: one button, three ways in — the basic guide, the advanced
 * guide, and the textual overview of every feature (feature 21's tour window).
 */
export function GuideMenuWeb() {
  const t = useTheme();
  const guide = useGuide();
  const tour = useTour(guide.managedTeamId);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);

  const pick = (kind: GuideId | 'tour') => {
    setOpen(false);
    trackEvent('guide_menu_choice', { choice: kind });
    if (kind === 'tour') tour.onOpen();
    else guide.start(kind);
  };

  const items: { key: GuideId | 'tour'; label: string; hint: string }[] = [
    { key: 'basic', label: G.menuBasic, hint: G.menuBasicHint },
    { key: 'advanced', label: G.menuAdvanced, hint: G.menuAdvancedHint },
    { key: 'tour', label: G.menuTour, hint: G.menuTourHint },
  ];

  return (
    <>
      <span ref={triggerRef} data-testid="guide-menu-trigger" style={{ display: 'inline-flex', flexShrink: 0 }}>
        <Button variant="ghost" size="sm" icon="map-pin" iconOnlyOnMobile onPress={() => { trackEvent('guide_menu_opened'); setOpen(true); }}>
          {G.menuButton}
        </Button>
      </span>
      <Menu anchorEl={triggerRef.current} open={open} onClose={() => setOpen(false)} slotProps={{ list: { 'aria-label': G.menuLabel } }}>
        {items.map((item) => (
          <MenuItem
            key={item.key}
            onClick={() => pick(item.key)}
            data-testid={`guide-menu-${item.key}`}
            sx={{ minHeight: t.layout.minTouchTarget, minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}
          >
            <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>{item.label}</Typography>
            <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{item.hint}</Typography>
          </MenuItem>
        ))}
      </Menu>
      <TourDialogWeb tour={tour} />
    </>
  );
}
