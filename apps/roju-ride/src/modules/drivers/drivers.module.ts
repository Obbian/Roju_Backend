import { Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [LocationModule],
  controllers: [DriversController],
  providers: [DriversService],
})
export class DriversModule {}
