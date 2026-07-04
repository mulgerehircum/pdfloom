import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: AuthCredentialsDto): Promise<{ accessToken: string }> {
    const existing = await this.usersService.findByUsername(dto.username);
    if (existing) {
      throw new ConflictException(`Username "${dto.username}" is already taken`);
    }
    const user = await this.usersService.create(dto.username, dto.password);
    return this.issueToken(user._id.toString(), user.username);
  }

  async login(dto: AuthCredentialsDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid username or password');
    }
    return this.issueToken(user._id.toString(), user.username);
  }

  private issueToken(userId: string, username: string): { accessToken: string } {
    const accessToken = this.jwtService.sign({ sub: userId, username });
    return { accessToken };
  }
}
