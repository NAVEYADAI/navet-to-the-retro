import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'retro-secret-key-12345';

  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const finalUsername = dto.username || dto.email;
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: finalUsername },
          { email: dto.email }
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
        email: dto.email,
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
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          { email: dto.username }
        ]
      }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
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
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
      }
    });

    const { password, ...result } = user;
    return result;
  }
}
