import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';

const SALT_ROUNDS = 10;
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  // Seeds a default admin so the app is usable immediately after a fresh docker-compose up,
  // without a separate manual setup step. Change the password after first login in real use.
  async onModuleInit() {
    const existingCount = await this.userModel.countDocuments();
    if (existingCount > 0) return;

    await this.create(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD);
    // eslint-disable-next-line no-console
    console.log(`Seeded default user "${DEFAULT_ADMIN_USERNAME}" / "${DEFAULT_ADMIN_PASSWORD}" — change this in real use.`);
  }

  async create(username: string, password: string): Promise<UserDocument> {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    return this.userModel.create({ username: username.toLowerCase(), passwordHash });
  }

  findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username: username.toLowerCase() }).exec();
  }
}
