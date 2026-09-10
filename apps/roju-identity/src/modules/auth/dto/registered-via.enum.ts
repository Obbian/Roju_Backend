// ADMIN_WEB is deliberately excluded — admin accounts are provisioned separately, not via
// self-serve OTP signup.
export enum RegisteredVia {
  CONSUMER_APP = 'CONSUMER_APP',
  EXECUTIVE_APP = 'EXECUTIVE_APP',
}
