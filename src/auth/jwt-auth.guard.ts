import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Applied per-route (see TemplatesController) rather than globally — most of this app is
// a public service; only saving a template requires being logged in.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
