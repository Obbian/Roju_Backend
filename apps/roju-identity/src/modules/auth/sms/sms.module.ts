import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleSmsProvider } from './console-sms.provider';
import { Msg91SmsProvider } from './msg91-sms.provider';
import { SMS_PROVIDER } from './sms-provider.interface';

@Module({
  providers: [
    ConsoleSmsProvider,
    Msg91SmsProvider,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService, ConsoleSmsProvider, Msg91SmsProvider],
      useFactory: (
        config: ConfigService,
        consoleProvider: ConsoleSmsProvider,
        msg91Provider: Msg91SmsProvider,
      ) => (config.get<string>('sms.msg91AuthKey') ? msg91Provider : consoleProvider),
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
