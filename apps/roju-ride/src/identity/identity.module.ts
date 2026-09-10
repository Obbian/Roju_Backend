import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

// Global, verification-only counterpart to roju-identity's Auth module — every feature
// module in this app gets JwtAuthGuard/RolesGuard for free, without importing this module
// individually (see HLD: identity extraction, §6).
//
// `global: true` matters here: @Global() on IdentityModule only broadcasts ITS OWN
// providers (JwtAuthGuard, RolesGuard) app-wide — it does not transitively make JwtModule's
// JwtService global too. A guard applied via @UseGuards() resolves its constructor deps
// against the consuming controller's own module context, so without this flag JwtService
// is only visible from within IdentityModule itself, and every other module fails to
// instantiate JwtAuthGuard.
@Global()
@Module({
  imports: [JwtModule.register({ global: true })],
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class IdentityModule {}
