import { Injectable } from '@nestjs/common';
import { ChannelOrderExtractionStatus } from '@prisma/client';
import { DatabaseService } from './database.service';

@Injectable()
export class OrderExtractionRepoService {
  constructor(private readonly prisma: DatabaseService) {}

  async getExtractionById(id: string) {
    return this.prisma.channelOrderExtraction.findUnique({
      where: { id },
      include: { channel: true },
    });
  }

  async updateExtractionStatus(
    id: string,
    status: ChannelOrderExtractionStatus,
  ) {
    await this.prisma.channelOrderExtraction.update({
      where: { id },
      data: { status },
    });
  }

  async extractionProcessed(id: string, orderTotal: number) {
    await this.prisma.channelOrderExtraction.update({
      where: { id },
      data: { status: ChannelOrderExtractionStatus.PROCESSED, orderTotal },
    });
  }

  async extractionError(id: string, errorDetails: string) {
    await this.prisma.channelOrderExtraction.update({
      where: { id },
      data: { status: ChannelOrderExtractionStatus.ERROR, errorDetails },
    });
  }

  async getPendingOrProcessingExtractionsByUserId(userId: string) {
    return this.prisma.channelOrderExtraction.findMany({
      where: {
        userId,
        status: {
          in: [
            ChannelOrderExtractionStatus.PENDING,
            ChannelOrderExtractionStatus.PROCESSING,
          ],
        },
      },
    });
  }

  async getPendingOrProcessingExtractionsByChannelIds(channelIds: string[]) {
    return this.prisma.channelOrderExtraction.findMany({
      where: {
        channelId: {
          in: channelIds,
        },
        status: {
          in: [
            ChannelOrderExtractionStatus.PENDING,
            ChannelOrderExtractionStatus.PROCESSING,
          ],
        },
      },
    });
  }

  async getLatestExtractionByChannelId(channelId: string) {
    return this.prisma.channelOrderExtraction.findFirst({
      where: { channelId, status: ChannelOrderExtractionStatus.PROCESSED },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMultipleExtractions(
    extractions: {
      id: string;
      userId: string;
      channelId: string;
      status: ChannelOrderExtractionStatus;
      orderTotal: number;
      createdBy: string;
    }[],
  ) {
    return this.prisma.channelOrderExtraction.createMany({
      data: extractions,
    });
  }
}
