import { Controller, Post, Body } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsString, IsNotEmpty } from 'class-validator';

class LoginDto {
  @IsString()
  @IsNotEmpty()
  storeId!: string;

  @IsString()
  @IsNotEmpty()
  storeName!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Mock login - generates a JWT with the store_id claim.
   * In production, this would verify credentials against a user database.
   */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const payload = {
      storeId: dto.storeId,
      storeName: dto.storeName,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      store_id: dto.storeId,
      store_name: dto.storeName,
      expires_in: '24h',
    };
  }
}
