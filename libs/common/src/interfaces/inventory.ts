import { FfType } from '../enums';

export interface InventoryResult {
  httpcode: number;
  items: InventoryItem[];
}

export interface InventoryItem {
  skuErp: string;
  existence: number;
  available: number;
  available_suggested: number;
  ffType: FfType;
}
