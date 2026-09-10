import { Body, Controller, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import { Roles } from '../../identity/decorators/roles.decorator';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard';
import { RolesGuard } from '../../identity/guards/roles.guard';
import type { JwtPayload } from '../../identity/types/jwt-payload.type';
import { DriversService } from './drivers.service';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Patch('status')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateDriverStatusDto,
  ): Promise<void> {
    await this.driversService.setStatus(user.sub, dto.status);
  }
}
