import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ColumnSort } from '../interfaces/generic';

export class BaseQueryDTO {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  globalFilter?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  pageSize?: number;

  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => {
        // If value is null, undefined or empty string, return null
        if (val === null || val === undefined || val === '') {
          return [key, null];
        }

        // Handle objects with Prisma operators (in, equals, etc.)
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          const transformedObj = {};
          for (const [operator, operatorValue] of Object.entries(val)) {
            if (operator === 'in' && Array.isArray(operatorValue)) {
              // Convert array values according to type
              const convertedValues = operatorValue.map((item) => {
                if (typeof item === 'string') {
                  const lowerItem = item.toLowerCase();
                  // Convert boolean strings
                  if (lowerItem === 'true') return true;
                  if (lowerItem === 'false') return false;
                  // Convert numeric strings
                  if (!isNaN(Number(item)) && item.trim() !== '') {
                    const numVal = Number(item);
                    if (!isNaN(numVal)) return numVal;
                  }
                  // For other strings, keep original value
                  return item;
                }
                return item;
              });

              // Detect if all values are booleans
              const allBooleans = convertedValues.every(
                (v) => typeof v === 'boolean',
              );
              if (allBooleans && convertedValues.length === 1) {
                // If there's only one boolean value, convert to simple value
                return [key, convertedValues[0]];
              }

              transformedObj[operator] = convertedValues;
            } else if (
              operator === 'equals' &&
              typeof operatorValue === 'string'
            ) {
              // Convert equals values
              const lowerVal = operatorValue.toLowerCase();
              if (lowerVal === 'true') {
                transformedObj[operator] = true;
              } else if (lowerVal === 'false') {
                transformedObj[operator] = false;
              } else {
                transformedObj[operator] = operatorValue;
              }
            } else if (
              // Handle date operators (gte, lte, gt, lt, equals)
              ['gte', 'lte', 'gt', 'lt', 'equals'].includes(operator) &&
              typeof operatorValue === 'string'
            ) {
              // Check if it's a date string (YYYY-MM-DD format)
              if (/^\d{4}-\d{2}-\d{2}$/.test(operatorValue)) {
                // Use complete ISO-8601 format with milliseconds that Prisma requires
                if (operator === 'gte') {
                  // For gte, use start of day
                  transformedObj[operator] = `${operatorValue}T00:00:00.000Z`;
                } else if (operator === 'lte') {
                  // For lte, use end of day
                  transformedObj[operator] = `${operatorValue}T23:59:59.999Z`;
                } else if (operator === 'gt') {
                  // For gt, use end of day to get next day
                  transformedObj[operator] = `${operatorValue}T23:59:59.999Z`;
                } else if (operator === 'lt') {
                  // For lt, use start of day
                  transformedObj[operator] = `${operatorValue}T00:00:00.000Z`;
                } else {
                  // For equals, use start of day
                  transformedObj[operator] = `${operatorValue}T00:00:00.000Z`;
                }
              } else {
                transformedObj[operator] = operatorValue;
              }
            } else {
              transformedObj[operator] = operatorValue;
            }
          }
          return [key, transformedObj];
        }

        // Convert boolean strings to booleans
        if (typeof val === 'string') {
          const lowerVal = val.toLowerCase();
          if (lowerVal === 'true') {
            return [key, true];
          }
          if (lowerVal === 'false') {
            return [key, false];
          }

          // Convert numeric strings to numbers
          if (!isNaN(Number(val)) && val.trim() !== '') {
            const numVal = Number(val);
            // Only convert if it's a valid number and not NaN
            if (!isNaN(numVal)) {
              return [key, numVal];
            }
          }

          // Check if it's a date string (YYYY-MM-DD format)
          if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
            // Use complete ISO-8601 format with milliseconds for Prisma
            return [key, `${val}T00:00:00.000Z`];
          }
        }

        // For other types, keep original value
        return [key, val];
      }),
    );
  })
  filters?: Record<string, any>;

  @IsOptional()
  @IsArray()
  sorting?: ColumnSort[];
}
