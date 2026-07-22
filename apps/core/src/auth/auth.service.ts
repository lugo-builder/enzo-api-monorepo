import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Rol, User } from '@prisma/client';

import { CustomException, EmailService, ErrorCodes } from '@app/common';
import { DatabaseService } from '@app/database';
import { LogService } from '@app/log';
import * as bcrypt from 'bcryptjs';

import { LogInRequestDto } from './dto/login-request.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly prisma: DatabaseService,
    private readonly logService: LogService,
  ) {}

  private readonly saltRounds = 10;

  generateAccessToken(email: string, userId: string, rol: Rol): string {
    const payload = this.jwtService.sign({
      userId: userId,
      email: email,
      rol: rol,
      authType: 'EMAIL',
    });
    return payload;
  }

  async login(oUser: LogInRequestDto): Promise<any> {
    try {
      const baseRelations = {
        role: {
          include: {
            RolPermission: {
              select: {
                permission: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      };

      const user = await this.prisma.user.findUnique({
        where: { email: oUser.email },
        include: baseRelations,
      });
      if (!user) {
        throw new CustomException(ErrorCodes.USER_NOT_FOUND);
      }

      // Comparar la contraseña ingresada con la almacenada (encriptada)
      const isPasswordValid = await this.comparePassword(
        oUser.password,
        user.password,
      );
      if (!isPasswordValid) {
        throw new CustomException(ErrorCodes.INVALID_CREDENTIALS);
      }

      if (
        user.status === 'INACTIVE' &&
        (user.role.name === 'Admin' || user.role.name === 'SuperAdmin')
      ) {
        throw new CustomException(ErrorCodes.INACTIVE_USER);
      }
      if (
        user.deletedAt ||
        (user.status === 'INACTIVE' && user.deactivatedAt)
      ) {
        throw new CustomException(ErrorCodes.INVALID_CREDENTIALS);
      }
      if (
        oUser.clientApp === 'ADMIN' &&
        user.role.name !== 'Admin' &&
        user.role.name !== 'SuperAdmin'
      ) {
        throw new CustomException(ErrorCodes.INVALID_CREDENTIALS);
      }
      if (oUser.clientApp === 'CLIENT' && user.role.name !== 'Fulfillment') {
        throw new CustomException(ErrorCodes.INVALID_CREDENTIALS);
      }

      return {
        access_token: this.generateAccessToken(user.email, user.id, user.role),
        user: this.simplifyUserData(user),
      };
    } catch (error) {
      this.logService.error('Error in login', AuthService.name, error);
      if (error instanceof CustomException) {
        throw error;
      }
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }

  sanitizeUser(user: User & { role: Rol }) {
    const sanitizedUser = { ...user };
    delete sanitizedUser.createdBy;
    delete sanitizedUser.createdAt;
    delete sanitizedUser.updatedBy;
    delete sanitizedUser.updatedAt;
    delete sanitizedUser.deletedBy;
    delete sanitizedUser.deletedAt;
    delete sanitizedUser.role.createdAt;
    delete sanitizedUser.role.createdBy;
    delete sanitizedUser.role.updatedAt;
    delete sanitizedUser.role.updatedBy;
    delete sanitizedUser.role.deletedAt;
    delete sanitizedUser.role.deletedBy;
    return sanitizedUser;
  }

  simplifyUserData(user: DetailedUserWithRoleAndPermissions) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      role: {
        id: user.role.id,
        name: user.role.name,
        permissions: user.role.RolPermission.map((rp) => rp.permission),
      },
    };
  }

  // Método para encriptar la contraseña
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.saltRounds);
    return bcrypt.hash(password, salt);
  }

  // Método para comparar la contraseña ingresada con la hash almacenada
  async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async verifyToken(token: string): Promise<any> {
    try {
      this.jwtService.verify(token);
      return true;
    } catch (error) {
      this.logService.error('Error verifying token', AuthService.name, error);
      return false;
    }
  }

  async validateEmail(email: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new CustomException(ErrorCodes.USER_NOT_FOUND);
    }

    return user;
  }

  async updatePassword(token: string, bodyPassword: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      const [header, payLoad, signature] = token.split('.');
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user) {
        throw new CustomException(ErrorCodes.USER_NOT_FOUND);
      }
      if (user.passwordRegistered && signature === user.passwordRegistered) {
        throw new CustomException(ErrorCodes.PASSWORD_HAS_BEEN_UPDATED);
      }

      // Encriptar la contraseña antes de actualizarla
      const hashedPassword = await this.hashPassword(bodyPassword);

      await this.prisma.user.update({
        where: { id: payload.userId },
        data: {
          password: hashedPassword,
          passwordRegistered: signature,
        },
      });
      return { message: 'Password updated successfully', code: 200 };
    } catch (error) {
      this.logService.error('Error updating password', AuthService.name, error);
      throw error;
    }
  }

  async sendRecoveryEmail(email: string, isAdmin: boolean): Promise<any> {
    try {
      const user = await this.prisma.user.findFirst({
        where: { email },
      });
      if (!user) {
        throw new CustomException(ErrorCodes.USER_NOT_FOUND);
      }
      const token = this.jwtService.sign({ userId: user.id });

      const enlace_restauracion = isAdmin
        ? `${this.configService.get<string>('FRONTEND_ADMIN_URL')}/register-password/${token}`
        : `${this.configService.get<string>('FRONTEND_URL')}/register-password/${token}`;

      await this.emailService.sendEmail(
        'recovery-pass',
        { email, nombre: user.name, enlace_restauracion },
        email,
        'Recuperación de contraseña a Promologistics Fullfilment!!!',
      );

      return { token };
    } catch (error) {
      this.logService.error(
        'Error sending recovery email',
        AuthService.name,
        error,
      );
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }

  validatePassword(password: string): string[] {
    const errors: string[] = [];
    if (password.length < 11)
      errors.push('Password must be at least 11 characters long');
    if (!/[A-Z]/.test(password))
      errors.push('Password must contain at least one uppercase letter');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password))
      errors.push('Password must contain at least one special character');
    if (!/\d/.test(password))
      errors.push('Password must contain at least one number');
    return errors;
  }

  async registerAccount(
    email: string,
    name: string,
    phone: string,
    company?: string,
  ): Promise<any> {
    try {
      const user = await this.prisma.user.findFirst({
        where: { email },
      });
      if (user) {
        throw new CustomException(ErrorCodes.USER_ALREADY_EXISTS);
      }

      const newUser = await this.prisma.user.create({
        data: {
          email,
          name,
          phone,
          company: company || null,
          role: {
            connect: {
              name: 'Fulfillment',
            },
          },
        },
      });

      const token = this.jwtService.sign({ userId: newUser.id });
      const enlace_registro = `${this.configService.get<string>('FRONTEND_URL')}/register-password/${token}`;

      await this.emailService.sendEmail(
        'welcome',
        { email, nombre: newUser.name, enlace_registro },
        email,
        'Bienvenido a Promologistics Fullfilment!!!',
      );

      const enlace_administracion = `${this.configService.get<string>('FRONTEND_ADMIN_URL')}/clients/list`;
      const adminUsers = await this.prisma.user.findMany({
        where: { role: { name: 'Admin' }, status: 'ACTIVE' },
      });
      await Promise.all(
        adminUsers.map(async (adminUser) => {
          await this.emailService.sendEmail(
            'new-user-registered',
            {
              email_usuario: email,
              nombre_usuario: newUser.name,
              enlace_administracion,
            },
            adminUser.email,
            'Nuevo usuario registrado',
          );
        }),
      );
      return { message: 'User created successfully' };
    } catch (error) {
      this.logService.error(
        'Error registering account',
        AuthService.name,
        error,
      );
      if (error instanceof CustomException) {
        throw error;
      }
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }
}

type DetailedUserWithRoleAndPermissions = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  role: {
    id: string;
    name: string;
    RolPermission: {
      permission: {
        id: string;
        name: string;
      };
    }[];
  };
};
