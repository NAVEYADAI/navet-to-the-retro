import { Injectable, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'retro-secret-key-12345';

  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim();
    const finalUsername = dto.username || email;
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

    // §7.4 (2026-09-11): the frontend always sends the *current* email on every save (even a
    // firstName-only edit), so "was `email` present in the DTO" is not a valid change signal —
    // only an actual value diff (trimmed, case-insensitive) is.
    const trimmedEmail = dto.email?.trim();
    const emailChanged = trimmedEmail !== undefined
      && trimmedEmail.toLowerCase() !== current.email.toLowerCase();

    if (emailChanged) {
      // Plain "don't let a profile form silently steal someone else's stored email" check —
      // unrelated to the deferred Google-sign-in collision decision (product-backlog/07-google-sign-in.md §7.0
      // decision #3), which stays exactly as-is and is not reopened here.
      const collision = await this.prisma.user.findFirst({
        where: { email: { equals: trimmedEmail, mode: 'insensitive' }, NOT: { id: userId } }
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
        email: emailChanged ? trimmedEmail : undefined,
        // Reset proof-of-ownership only on a genuine change — `googleId` is left untouched
        // either way, it identifies a Google account, not a claim about the current email.
        ...(emailChanged ? { emailVerifiedAt: null } : {}),
      }
    });

    const { password, ...result } = user;
    return result;
  }
}
