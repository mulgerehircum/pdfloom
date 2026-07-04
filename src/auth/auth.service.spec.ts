import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    findByUsername: jest.fn(),
    create: jest.fn(),
  };

  const jwtServiceMock = {
    sign: jest.fn(() => 'signed-token'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException when the username is already taken', async () => {
      usersServiceMock.findByUsername.mockResolvedValue({ username: 'existing' });

      await expect(service.register({ username: 'existing', password: 'password123' })).rejects.toBeInstanceOf(
        ConflictException
      );
      expect(usersServiceMock.create).not.toHaveBeenCalled();
    });

    it('creates the user and returns a token when the username is free', async () => {
      usersServiceMock.findByUsername.mockResolvedValue(null);
      usersServiceMock.create.mockResolvedValue({ _id: 'u1', username: 'newuser' });

      const result = await service.register({ username: 'newuser', password: 'password123' });

      expect(usersServiceMock.create).toHaveBeenCalledWith('newuser', 'password123');
      expect(result).toEqual({ accessToken: 'signed-token' });
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when the user does not exist', async () => {
      usersServiceMock.findByUsername.mockResolvedValue(null);

      await expect(service.login({ username: 'ghost', password: 'password123' })).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      usersServiceMock.findByUsername.mockResolvedValue({ _id: 'u1', username: 'user', passwordHash });

      await expect(service.login({ username: 'user', password: 'wrong-password' })).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });

    it('returns a token when credentials are correct', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      usersServiceMock.findByUsername.mockResolvedValue({ _id: 'u1', username: 'user', passwordHash });

      const result = await service.login({ username: 'user', password: 'correct-password' });

      expect(result).toEqual({ accessToken: 'signed-token' });
    });
  });
});
