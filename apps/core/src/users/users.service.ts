import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import {
  config,
  CustomException,
  EmailService,
  ErrorCodes,
  ListResponseDto,
  Pagination,
} from '@app/common';
import { User } from '@prisma/client';

import { DatabaseService } from '@app/database';
import { LogService } from '@app/log';
import { AuthService } from '../auth/auth.service';
import { FilterDto } from './dto/filter.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { RolUpdateDto } from './dto/rol-update.dto';
import { StatusUpdateDto } from './dto/status-update.dto';

@Injectable()
export class UsersService {
  private readonly urlFulfillment: string;

  constructor(
    private readonly prisma: DatabaseService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly logService: LogService,
  ) {
    this.urlFulfillment = config.frontUrl;
  }

  async create(payLoad: RegisterRequestDto, userId: string): Promise<User> {
    const { email, name } = payLoad;
    let roleId = payLoad.roleId;
    let rol = null;
    if (roleId) {
      rol = await this.prisma.rol.findFirst({
        where: { id: roleId, deletedAt: null },
      });
      if (!rol) {
        throw new CustomException(ErrorCodes.ROL_NOT_FOUND);
      }
    } else {
      const defaultRol = await this.prisma.rol.findFirst({
        where: { name: config.defaultRol, deletedAt: null },
      });
      if (!defaultRol) {
        throw new CustomException(ErrorCodes.ROL_NOT_FOUND);
      }
      roleId = defaultRol.id;
    }
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (user) {
      throw new CustomException(ErrorCodes.USER_ALREADY_EXISTS);
    }

    // Encriptar la contraseña antes de almacenarla
    const hashedPassword = await this.authService.hashPassword(
      config.defaultPassword,
    );

    try {
      const newUser = await this.prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          createdAt: new Date(),
          createdBy: userId,
          status: rol && rol.name === 'Fulfillment' ? 'INACTIVE' : 'ACTIVE',
          role: {
            connect: {
              id: roleId,
            },
          },
        },
      });

      const token = this.jwtService.sign(
        { userId: newUser.id },
        {
          expiresIn: `${this.configService.get<string>('TOKEN_EXPIRATION_TIME')}`,
        },
      );
      const registrationLink = `${this.configService.get<string>('FRONTEND_ADMIN_URL')}/register-password/${token}`;
      await this.notifyUser(email, name, registrationLink);

      return newUser;
    } catch (error) {
      if (error instanceof CustomException) {
        throw error;
      }
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }

  async findAll(filterDto: FilterDto): Promise<ListResponseDto<User>> {
    const {
      role,
      isActive,
      createdAt,
      globalFilter = '',
      filters,
      page,
      pageSize,
      sorting,
    } = filterDto;
    const customFilters: any = {};

    if (role) {
      customFilters.role = {
        name: {
          in: role.split(','),
        },
      };
    }
    if (isActive) {
      customFilters.isActive = { contains: isActive };
    }
    if (createdAt) {
      customFilters.createdAt = { contains: createdAt };
    }

    const whereCondition = {
      ...filters,
      ...customFilters,
    };

    if (globalFilter !== '') {
      whereCondition.OR = [
        {
          email: {
            contains: globalFilter,
          },
        },
        {
          name: {
            contains: globalFilter,
          },
        },
      ];
    }

    const orderBy = sorting?.map((sort) => ({
      [sort.id]: sort.desc === 'true' ? 'desc' : 'asc',
    }));

    const pagination = {} as Pagination;

    if (page && pageSize) {
      pagination.skip = (page - 1) * pageSize;
      pagination.take = pageSize;
    }

    const data = await this.prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        createdBy: true,
        updatedAt: true,
        updatedBy: true,
        deletedAt: true,
        deletedBy: true,
        deactivatedAt: true,
        roleId: true,
        emailVerified: true,
        phone: true,
        passwordRegistered: true,
        company: true,
        password: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy, // Ordenación
      ...pagination, // Paginación
    });
    const totalRecords = await this.prisma.user.count({
      where: whereCondition,
    });

    return { data, totalRecords };
  }

  async findOne(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        createdBy: true,
        updatedAt: true,
        updatedBy: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateRole(
    id: string,
    rolUpdateDto: RolUpdateDto,
    updatedById: string,
  ) {
    try {
      const rol = await this.prisma.rol.findFirst({
        where: { id: rolUpdateDto.roleId, deletedAt: null },
      });
      if (!rol) {
        throw new CustomException(ErrorCodes.ROL_NOT_FOUND);
      }
      const user = await this.prisma.user.findFirst({
        where: { id, deletedAt: null },
      });
      if (!user) {
        throw new CustomException(ErrorCodes.USER_NOT_FOUND);
      }
      return await this.prisma.user
        .update({
          where: { id },
          data: {
            role: {
              connect: {
                id: rolUpdateDto.roleId,
              },
            },
            updatedAt: new Date(),
            updatedBy: updatedById,
          },
        })
        .then((result) =>
          result
            ? this.prisma.user.findUnique({
                where: { id },
                select: {
                  id: true,
                  email: true,
                  name: true,
                  createdAt: true,
                  createdBy: true,
                  updatedAt: true,
                  updatedBy: true,
                  role: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              })
            : null,
        );
    } catch (error) {
      if (error instanceof CustomException) {
        throw error;
      }
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }

  async remove(id: string): Promise<User> {
    return this.prisma.user
      .deleteMany({
        where: { id },
      })
      .then((result) =>
        result.count ? this.prisma.user.findUnique({ where: { id } }) : null,
      );
  }

  async updateStatus(
    id: string,
    statusUpdateDto: StatusUpdateDto,
    updatedById: string,
  ) {
    try {
      const user = await this.prisma.user.findFirst({
        where: { id, deletedAt: null },
      });
      if (!user) {
        throw new CustomException(ErrorCodes.USER_NOT_FOUND);
      }
      return await this.prisma.user
        .update({
          where: { id },
          data: {
            status: statusUpdateDto.status,
            updatedAt: new Date(),
            updatedBy: updatedById,
          },
        })
        .then((result) =>
          result
            ? this.prisma.user.findUnique({
                where: { id },
                select: {
                  id: true,
                  email: true,
                  name: true,
                  status: true,
                  createdAt: true,
                  createdBy: true,
                  updatedAt: true,
                  updatedBy: true,
                  role: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              })
            : null,
        );
    } catch (error) {
      if (error instanceof CustomException) {
        throw error;
      }
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }

  async updateStatusBack(id: string, updatedById: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: { id, deletedAt: null },
      });
      if (!user) {
        throw new CustomException(ErrorCodes.USER_NOT_FOUND);
      }
      const newStatus =
        user.status === 'INACTIVE'
          ? { status: 'ACTIVE' }
          : {
              status: 'INACTIVE',
              deactivatedAt: new Date(),
            };
      return await this.prisma.user
        .update({
          where: { id },
          data: {
            ...newStatus,
            updatedAt: new Date(),
            updatedBy: updatedById,
          },
        })
        .then((result) =>
          result
            ? this.prisma.user.findUnique({
                where: { id },
                select: {
                  id: true,
                  email: true,
                  name: true,
                  status: true,
                  createdAt: true,
                  createdBy: true,
                  updatedAt: true,
                  updatedBy: true,
                  role: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              })
            : null,
        );
    } catch (error) {
      if (error instanceof CustomException) {
        throw error;
      }
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }

  async updateAuthorization(id: string, updatedById: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: { id, deletedAt: null },
      });
      if (!user) {
        throw new CustomException(ErrorCodes.USER_NOT_FOUND);
      }
      const newStatus =
        user.status === 'INACTIVE'
          ? { status: 'ACTIVE' }
          : {
              status: 'INACTIVE',
              deactivatedAt: new Date(),
            };
      const result = await this.prisma.user.update({
        where: { id },
        data: {
          ...newStatus,
          updatedAt: new Date(),
          updatedBy: updatedById,
        },
      });

      const urlFulfillmentToRedirect = `${this.urlFulfillment}/channels/list`;
      if (newStatus.status === 'ACTIVE') {
        await this.emailService.sendEmail(
          'new-user-status-updated',
          {
            url_fulfillment: urlFulfillmentToRedirect,
          },
          user.email,
          'Usuario activado',
        );
      }
      const userResult = result
        ? this.prisma.user.findUnique({
            where: { id },
            select: {
              id: true,
              email: true,
              name: true,
              status: true,
              createdAt: true,
              createdBy: true,
              updatedAt: true,
              updatedBy: true,
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        : null;
      return userResult;
    } catch (error) {
      if (error instanceof CustomException) {
        throw error;
      }
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }

  async notifyUser(
    email: string,
    nombre: string,
    enlace_registro: string,
  ): Promise<void> {
    try {
      await this.emailService.sendEmail(
        'welcome',
        { email, nombre, enlace_registro },
        email,
        'Bienvenido a Promologistics Fullfilment!!!',
      );
    } catch (error) {
      if (error instanceof CustomException) {
        throw error;
      }
      throw new CustomException(ErrorCodes.EMAIL_NOT_SENT);
    }
  }

}
