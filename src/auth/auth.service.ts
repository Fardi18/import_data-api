import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { compare } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';

const prisma = new PrismaClient();

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin || !(await compare(password, admin.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const expiryDate = new Date(
      Date.now() + +(process.env.OTP_EXPIRE_MINUTES ?? 5) * 60000,
    );

    const otpLog = await prisma.otpLog.create({
      data: {
        adminId: admin.id,
        otp,
        expiryDate,
      },
    });

    return {
      message: 'OTP sent',
      otpId: otpLog.id,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const { otpId, otp } = dto;

    const otpLog = await prisma.otpLog.findUnique({
      where: { id: otpId },
      include: { admin: true },
    });

    if (!otpLog) {
      throw new UnauthorizedException('OTP ID not found');
    }

    if (otpLog.verifiedAt) {
      throw new UnauthorizedException('OTP already used');
    }

    // if (otpLog.expiryDate < new Date()) {
    //     throw new UnauthorizedException('OTP expired');
    // }

    if (otpLog.otp !== otp) {
      throw new UnauthorizedException('Incorrect OTP');
    }

    await prisma.otpLog.update({
      where: { id: otpId },
      data: { verifiedAt: new Date() },
    });

    const payload = { sub: otpLog.admin.id, email: otpLog.admin.email };
    const token = this.jwtService.sign(payload);

    return {
      message: 'OTP verified successfully',
      access_token: token,
      admin: {
        id: otpLog.admin.id,
        name: otpLog.admin.name,
        email: otpLog.admin.email,
      },
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    const { email } = dto;
    const admin = await prisma.admin.findUnique({ where: { email } });
  
    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }
  
    // Check for the latest OTP
    const latestOtpLog = await prisma.otpLog.findFirst({
      where: {
        adminId: admin.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  
    // Validate the latest OTP
    if (latestOtpLog) {
      const now = new Date();
      if (latestOtpLog.expiryDate > now) {
        return {
          message: 'The latest OTP is still valid',
        };
      }
  
      // Delete the expired OTP
      await prisma.otpLog.delete({
        where: {
          id: latestOtpLog.id,
        },
      });
    }
  
    // Generate and send a new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const expiryDate = new Date(
      Date.now() + +(process.env.OTP_EXPIRE_MINUTES ?? 5) * 60000,
    );
  
    await prisma.otpLog.create({
      data: {
        adminId: admin.id,
        otp,
        expiryDate,
      },
    });
  
    return {
      message: 'OTP resent',
    };
  }
}
