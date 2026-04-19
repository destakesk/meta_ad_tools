import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @IsOptional()
  @IsString()
  invitationToken?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class MfaSetupDto {
  @IsString()
  @IsNotEmpty()
  mfaSetupToken!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  totpCode!: string;
}

export class MfaVerifyDto {
  @IsString()
  @IsNotEmpty()
  mfaChallengeToken!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(11)
  code!: string;
}

export class EmailVerifyDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ResendVerificationDto {
  @IsEmail()
  email!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class MfaSetupInitQueryDto {
  @IsString()
  @IsNotEmpty()
  mfaSetupToken!: string;
}
