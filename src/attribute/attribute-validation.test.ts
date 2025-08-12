import { Test, TestingModule } from '@nestjs/testing';
import { AttributeService } from './attribute.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

// Mock Prisma Service
const mockPrismaService = {
  attribute: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('AttributeService - Validation Optimization', () => {
  let service: AttributeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributeService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AttributeService>(AttributeService);
  });

  describe('Default Value Validation Performance Tests', () => {
    it('should handle STRING type conversion efficiently', () => {
      // Test the private method via reflection for performance testing
      const processDefaultValue = (service as any).processDefaultValue.bind(service);
      
      expect(processDefaultValue('STRING', 123)).toBe('123');
      expect(processDefaultValue('STRING', true)).toBe('true');
      expect(processDefaultValue('STRING', 'test')).toBe('test');
    });

    it('should handle INTEGER type conversion with validation', () => {
      const processDefaultValue = (service as any).processDefaultValue.bind(service);
      
      expect(processDefaultValue('INTEGER', '123')).toBe(123);
      expect(processDefaultValue('INTEGER', 456)).toBe(456);
      expect(() => processDefaultValue('INTEGER', 'abc')).toThrow(BadRequestException);
    });

    it('should handle BOOLEAN type conversion flexibly', () => {
      const processDefaultValue = (service as any).processDefaultValue.bind(service);
      
      expect(processDefaultValue('BOOLEAN', 'true')).toBe(true);
      expect(processDefaultValue('BOOLEAN', 'false')).toBe(false);
      expect(processDefaultValue('BOOLEAN', '1')).toBe(true);
      expect(processDefaultValue('BOOLEAN', '0')).toBe(false);
      expect(processDefaultValue('BOOLEAN', 1)).toBe(true);
      expect(processDefaultValue('BOOLEAN', 0)).toBe(false);
    });

    it('should handle ARRAY type conversion intelligently', () => {
      const processDefaultValue = (service as any).processDefaultValue.bind(service);
      
      expect(processDefaultValue('ARRAY', [1, 2, 3])).toEqual([1, 2, 3]);
      expect(processDefaultValue('ARRAY', '[1,2,3]')).toEqual([1, 2, 3]);
      expect(processDefaultValue('ARRAY', 'a,b,c')).toEqual(['a', 'b', 'c']);
      expect(processDefaultValue('ARRAY', 'single')).toEqual(['single']);
    });

    it('should handle JSON type validation', () => {
      const processDefaultValue = (service as any).processDefaultValue.bind(service);
      
      const validObject = { key: 'value' };
      expect(processDefaultValue('JSON', validObject)).toEqual(validObject);
      expect(processDefaultValue('JSON', '{"key":"value"}')).toEqual(validObject);
      expect(() => processDefaultValue('JSON', '{invalid')).toThrow(BadRequestException);
    });

    it('should handle null and undefined values consistently', () => {
      const processDefaultValue = (service as any).processDefaultValue.bind(service);
      
      expect(processDefaultValue('STRING', null)).toBe(null);
      expect(processDefaultValue('STRING', undefined)).toBe(null);
      expect(processDefaultValue('INTEGER', null)).toBe(null);
      expect(processDefaultValue('BOOLEAN', null)).toBe(null);
    });
  });

  describe('Validator Cache Performance', () => {
    it('should use cached validators for repeated calls', () => {
      const processDefaultValue = (service as any).processDefaultValue.bind(service);
      
      // Multiple calls should use cached validators
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        processDefaultValue('STRING', 'test');
        processDefaultValue('INTEGER', 123);
        processDefaultValue('BOOLEAN', true);
      }
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100); // Should be very fast due to caching
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error messages for invalid conversions', () => {
      const processDefaultValue = (service as any).processDefaultValue.bind(service);
      
      expect(() => processDefaultValue('INTEGER', 'not-a-number')).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Cannot convert "not-a-number" to integer')
        })
      );
      
      expect(() => processDefaultValue('BOOLEAN', 'maybe')).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Cannot convert string "maybe" to boolean')
        })
      );
    });
  });
});
