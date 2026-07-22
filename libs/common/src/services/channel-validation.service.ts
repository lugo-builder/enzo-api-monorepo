import { CustomException, ErrorCodes } from '@app/common';
import { DatabaseService } from '@app/database';
import { LogService } from "@app/log";
import { Injectable } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

@Injectable()
export class ChannelValidationService {
    private readonly logService: LogService;

    constructor(
        private readonly prisma: DatabaseService,
        private readonly moduleRef: ModuleRef,
      ) {
        this.logService = this.moduleRef.get(LogService, { strict: false });
      }

    /**
     * Validates that a channel can be created without conflicts
     * @param partnerId - The partner ID for the new channel
     * @param channelIntegratorId - The channel integrator ID (optional)
     * @throws CustomException if a duplicate channel exists
     */
    async validateChannelCreation(partnerId: string, channelIntegratorId?: string): Promise<void> {
        let channelIntegratorShortId: string | null = null;
        if (channelIntegratorId) {
            const channelIntegrator = await this.prisma.channelIntegrator.findUnique({
                where: { id: channelIntegratorId },
                select: { shortId: true },
            });
            channelIntegratorShortId = channelIntegrator?.shortId || null;
        }

        // Validate that there is no channel with the same combination of channelIntegrator.shortId and channel.partnerId
        const existingChannels = await this.prisma.channel.findMany({
            where: {
                partnerId: partnerId,
                deletedAt: null,
            },
            include: {
                channelIntegrator: {
                    select: { shortId: true },
                },
            },
        });

        // Check if there is a channel with the same partnerId and ChannelIntegrator shortId
        // Handle cases where there is no associated channelIntegrator (null)
        const channelExists = existingChannels.some(channel => {
            if (!channelIntegratorId) {
                return !channel.channelIntegratorId;
            }
            return channel.channelIntegrator?.shortId === channelIntegratorShortId;
        });

        if (channelExists) {
            throw new CustomException(ErrorCodes.CHANNEL_ALREADY_EXISTS);
        }
    }
}