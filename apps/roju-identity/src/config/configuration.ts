export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3100', 10),
  // Only used to list an extra selectable server in Swagger UI (e.g. a temporary ngrok
  // tunnel) so "Try it out" hits the right host — unset in normal local dev.
  publicApiUrl: process.env.PUBLIC_API_URL,

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    // Rotated on every refresh — a device that keeps opening the app stays signed in
    // indefinitely; this TTL only bounds a never-reused (lost/abandoned) token.
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '180d',
  },

  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '300', 10),
  },

  sms: {
    // MSG91 — primary OTP delivery (see sms/msg91-sms.provider.ts). Left unset in dev/CI on
    // purpose: SmsModule falls back to logging the code to console when this is empty, so
    // the OTP flow stays testable without real credentials.
    msg91AuthKey: process.env.MSG91_AUTH_KEY,
    msg91OtpTemplateId: process.env.MSG91_OTP_TEMPLATE_ID,

    // Twilio — secondary/backup delivery, only used when configured. If MSG91 is down or
    // misconfigured, SmsModule tries this next before giving up to the console fallback (see
    // sms/chained-sms.provider.ts). Independent of MSG91 — either can be configured alone.
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
  },

  whatsapp: {
    // MSG91 WhatsApp — template notifications/support messages. Not wired to anything yet;
    // there's no Notifications module in either app to hang this off of. Kept here so the
    // credential isn't lost before that module exists.
    msg91AuthKey: process.env.MSG91_WHATSAPP_AUTH_KEY,
    msg91IntegratedNumber: process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
  },
});
