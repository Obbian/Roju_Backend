export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
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
    // Rotated on every refresh (TokenService.rotateRefreshToken), so a device that keeps
    // opening the app stays signed in indefinitely — this TTL only bounds how long a
    // never-reused (lost/abandoned) token stays valid, not typical session length.
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '180d',
  },

  otp: {
    providerApiKey: process.env.OTP_PROVIDER_API_KEY,
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '300', 10),
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  fcm: {
    serverKey: process.env.FCM_SERVER_KEY,
  },

  maps: {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  },

  weather: {
    // Drives the weather-based fare multiplier (WeatherService). Left unset in dev/CI on
    // purpose — PricingService falls back to no surge when this is empty, same pattern as
    // the maps key above.
    openWeatherMapApiKey: process.env.OPENWEATHERMAP_API_KEY,
  },
});
