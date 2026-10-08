import { Injectable, BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt-secret';

// BUG-37: minimal password policy (register only — login must keep accepting legacy short passwords).
export const MIN_PASSWORD_LENGTH = 6;
// BUG-18: deliberately loose shape check (something@something.tld, no whitespace) — not RFC-complete.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AuthService {
  private readonly jwtSecret = getJwtSecret();

  constructor(private readonly prisma: PrismaService) {}

  // BUG-15 (auth part): there is no global ValidationPipe, so a missing / non-string field used to
  // reach `.trim()` / `bcrypt` / Prisma and surface as a 500 (or, for an object `username`, as a
  // Prisma filter injection). Reject it up front with a clean 400 instead.
  private requireNonEmptyString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException(`${field} is required`);
    }
    return value;
  }

  async register(dto: RegisterDto) {
    dto = dto ?? ({} as RegisterDto);
    const email = this.requireNonEmptyString(dto.email, 'email').trim();
    if (typeof dto.password !== 'string' || dto.password.length === 0) {
      throw new BadRequestException('password is required');
    }
    if (dto.password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
    }
    if (dto.username !== undefined && dto.username !== null && typeof dto.username !== 'string') {
      throw new BadRequestException('username must be a string');
    }
    const finalUsername = dto.username || email;
    // BUG-38: login matches `username OR email`, so a username that looks like an email address
    // must be the registrant's own email — otherwise someone could squat victim@x as a username
    // (blocking the victim's later registration with 409 and shadowing their login lookup).
    if (finalUsername.includes('@') && finalUsername.trim().toLowerCase() !== email.toLowerCase()) {
      throw new BadRequestException('שם משתמש שנראה כמו כתובת אימייל חייב להיות זהה לכתובת האימייל שלך');
    }
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: finalUsername },
          { email: { equals: email, mode: 'insensitive' } }
        ]
      }
    });

    if (existingUser) {
      throw new ConflictException('Username or email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: finalUsername,
        email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role || 'DEVELOPER',
      }
    });

    const accessToken = jwt.sign(
      { sub: user.id, username: user.username, email: user.email },
      this.jwtSecret,
      { expiresIn: '12h' }
    );

    const { password, ...result } = user;
    return {
      accessToken,
      user: result
    };
  }

  async login(dto: LoginDto) {
    dto = dto ?? ({} as LoginDto);
    this.requireNonEmptyString(dto.username, 'username');
    if (typeof dto.password !== 'string' || dto.password.length === 0) {
      throw new BadRequestException('password is required');
    }
    // Feature 7 fallout (product-backlog/07-google-sign-in.md §7 findings, 2026-09-11): `User.email` is no longer
    // @unique (decision #3), so a login-by-email lookup needs a deterministic pick too — same
    // fix as google-login.service.ts, so a genuine password owner never gets shadowed by an
    // unrelated Google-only row that happens to share the email.
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          { email: dto.username }
        ]
      },
      orderBy: { id: 'asc' }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Feature 7 (product-backlog/07-google-sign-in.md §7.0 default #4): a Google-only user has `password: null`
    // permanently, by design — not a transitional state. Guard explicitly instead of letting
    // `bcrypt.compare` throw on a non-string hash.
    // Cross-feature note (2026-09-14, found in the feature-9 phantom-members audit):
    // `password: null` is no longer exclusively "Google-only" once phantom members (feature 9,
    // product-backlog/09-phantom-members.md) exist — a phantom's `User` row also has
    // `password: null`. Low real-world risk (a phantom's random `username` is never typed by
    // anyone), so left as-is rather than reworded speculatively — revisit this message only if
    // that assumption stops holding.
    if (user.password === null) {
      throw new UnauthorizedException('חשבון זה מחובר רק דרך Google, יש להשתמש בכפתור "המשך עם Google"');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = jwt.sign(
      { sub: user.id, username: user.username, email: user.email },
      this.jwtSecret,
      { expiresIn: '12h' }
    );

    const { password, ...userWithoutPassword } = user;
    return {
      accessToken,
      user: userWithoutPassword
    };
  }

  async validateToken(authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    try {
      const payload = jwt.verify(token, this.jwtSecret) as any;
      // Security fix (2026-09-14, found in code review): every short-lived, narrow-purpose JWT
      // this app mints (Google Calendar connect `state`, Google login `state`, Google login
      // `ticket`) is signed with this same `JWT_SECRET`. None of them used to carry any claim
      // distinguishing them from a real 12h session token, so a leaked one (e.g. the connect
      // `state`, which briefly appears in a URL sent to accounts.google.com) could be replayed
      // straight here as a Bearer session token. Real session tokens (`register`/`login`/
      // Google `issueSession`) never set `purpose` — any token that does is one of those
      // narrow-purpose tokens, never a session token, so reject it here explicitly.
      if (payload.purpose) {
        throw new UnauthorizedException('Invalid token');
      }
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub }
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async updateProfile(userId: number, dto: { firstName?: string; lastName?: string; email?: string }) {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) {
      throw new NotFoundException('User not found');
    }

    // BUG-18: an email that is present must be a non-empty, well-formed string (400 otherwise).
    // Normalised (trim + lowercase) before comparison and storage.
    let normalizedEmail: string | undefined;
    if (dto.email !== undefined) {
      if (typeof dto.email !== 'string' || !EMAIL_PATTERN.test(dto.email.trim())) {
        throw new BadRequestException('כתובת האימייל אינה תקינה');
      }
      normalizedEmail = dto.email.trim().toLowerCase();
    }
    for (const [field, value] of [['firstName', dto.firstName], ['lastName', dto.lastName]] as const) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        throw new BadRequestException(`${field} must be a string`);
      }
    }

    // §7.4 (2026-09-11): the frontend always sends the *current* email on every save (even a
    // firstName-only edit), so "was `email` present in the DTO" is not a valid change signal —
    // only an actual value diff (trimmed, case-insensitive) is.
    const emailChanged = normalizedEmail !== undefined
      && normalizedEmail !== current.email.toLowerCase();

    if (emailChanged) {
      // Plain "don't let a profile form silently steal someone else's stored email" check —
      // unrelated to the deferred Google-sign-in collision decision (product-backlog/07-google-sign-in.md §7.0
      // decision #3), which stays exactly as-is and is not reopened here.
      const collision = await this.prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' }, NOT: { id: userId } }
      });
      if (collision) {
        throw new ConflictException('כתובת האימייל הזו כבר בשימוש על ידי משתמש/ת אחר/ת');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: emailChanged ? normalizedEmail : undefined,
        // Reset proof-of-ownership only on a genuine change — `googleId` is left untouched
        // either way, it identifies a Google account, not a claim about the current email.
        ...(emailChanged ? { emailVerifiedAt: null } : {}),
      }
    });

    const { password, ...result } = user;
    return result;
  }
}
