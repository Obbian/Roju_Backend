import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChainedSmsProvider } from './chained-sms.provider';
import { ConsoleSmsProvider } from './console-sms.provider';
import { Msg91SmsProvider } from './msg91-sms.provider';
import { SMS_PROVIDER, type SmsProvider } from './sms-provider.interface';
import { TwilioSmsProvider } from './twilio-sms.provider';

@Module({
  providers: [
    ConsoleSmsProvider,
    Msg91SmsProvider,
    TwilioSmsProvider,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService, ConsoleSmsProvider, Msg91SmsProvider, TwilioSmsProvider],
      useFactory: (
        config: ConfigService,
        consoleProvider: ConsoleSmsProvider,
        msg91Provider: Msg91SmsProvider,
        twilioProvider: TwilioSmsProvider,
      ): SmsProvider => {
        // Only providers with real credentials configured are in the chain — MSG91 tried
        // first (primary), Twilio next if configured (backup), console log always last so an
        // OTP is never silently lost even if every real provider is down/misconfigured.
        const configuredProviders: SmsProvider[] = [];
        if (config.get<string>('sms.msg91AuthKey')) configuredProviders.push(msg91Provider);
        if (config.get<string>('sms.twilioAccountSid')) configuredProviders.push(twilioProvider);

        if (configuredProviders.length === 0) return consoleProvider;
        return new ChainedSmsProvider(configuredProviders);
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
