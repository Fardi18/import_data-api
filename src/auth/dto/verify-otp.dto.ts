import { IsNotEmpty, IsUUID, IsString } from 'class-validator';

export class VerifyOtpDto {
  @IsUUID()
  @IsNotEmpty()
  otpId: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}
