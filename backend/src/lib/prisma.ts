import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export const tenantContext = new AsyncLocalStorage<{ businessId: number }>();

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const basePrisma = globalForPrisma.prisma || new PrismaClient({ log: ['error', 'warn'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        const tenant = tenantContext.getStore();
        const businessId = tenant?.businessId;
        
        if (businessId) {
          const tenantModels = ['User', 'Category', 'Product', 'Customer', 'Sale', 'Expense', 'Inquiry', 'DebtPayment', 'SyncLog', 'CompanySettings'];
          
          if (tenantModels.includes(model)) {
            if (['findMany', 'findFirst', 'count', 'updateMany', 'deleteMany'].includes(operation)) {
              args.where = { ...args.where, businessId };
            } else if (['findUnique', 'update', 'delete'].includes(operation)) {
               const result = await query(args);
               if (result && result.businessId && result.businessId !== businessId) {
                  throw new Error('Unauthorized tenant access');
               }
               return result;
            } else if (operation === 'create') {
              args.data = { ...args.data, businessId };
            } else if (operation === 'createMany') {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((d: any) => ({ ...d, businessId }));
              } else {
                args.data = { ...args.data, businessId };
              }
            }
          }
        }
        return query(args);
      }
    }
  }
}) as unknown as typeof basePrisma;
