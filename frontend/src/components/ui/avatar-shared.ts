export interface AvatarProps {
  /** השם שממנו נלקחת האות הראשונה. */
  name: string;
  /** מזהה יציב (למשל member.id) שקובע את הגוון. */
  seed: number;
  /** sm = 24px בערימה על כפתור, md = 36px בשורת רשימה. */
  size?: 'sm' | 'md';
}

export function avatarInitial(name: string) {
  return name.replace(/^@/, '').trim().charAt(0).toUpperCase();
}
