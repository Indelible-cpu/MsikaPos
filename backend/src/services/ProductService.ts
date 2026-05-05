import { prisma } from '../lib/prisma';
import { AuditService } from './AuditService';

export class ProductService {
  static async listProducts(params: {
    q?: string;
    categoryId?: string;
    deleted?: boolean;
    user: any;
  }) {
    const { q, categoryId, deleted, user } = params;
    const where: any = {
      deleted: deleted ?? false,
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = parseInt(categoryId);
    }

    // Strict Branch Isolation
    if (user.role === 'SUPER_ADMIN') {
      if (user.branchId) {
        where.OR = [{ branchId: user.branchId }, { branchId: null }];
      }
    } else {
      where.branchId = user.branchId;
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    return products.map((p: any) => ({
      ...p,
      costPrice: Number(p.costPrice),
      sellPrice: Number(p.sellPrice),
      discountValue: p.discountValue ? Number(p.discountValue) : 0,
    }));
  }

  static async saveProduct(data: any, user: any) {
    const payload: any = {
      name: data.name,
      sku: data.sku,
      costPrice: Number(data.cost_price ?? data.costPrice),
      sellPrice: Number(data.sell_price ?? data.sellPrice),
      quantity: Number(data.quantity),
      isService: !!(data.is_service ?? data.isService),
      imageUrl: data.image_url || data.imageUrl || null,
      categoryId: parseInt(data.category_id ?? data.categoryId),
      branchId: user.role === 'SUPER_ADMIN' 
        ? (data.branchId || data.branch_id ? parseInt(data.branchId || data.branch_id) : user.branchId) 
        : user.branchId,
      discountType: data.discount_type || data.discountType || null,
      discountValue: data.discount_value || data.discountValue ? Number(data.discount_value || data.discountValue) : 0,
      discountStartDate: data.discount_start_date || data.discountStartDate ? new Date(data.discount_start_date || data.discountStartDate) : null,
      discountEndDate: data.discount_end_date || data.discountEndDate ? new Date(data.discount_end_date || data.discountEndDate) : null,
      deleted: data.deleted !== undefined ? !!data.deleted : false,
      updatedAt: new Date()
    };

    let product;
    const isUpdate = data.id && parseInt(data.id) < 1000000000;

    if (isUpdate) {
      product = await prisma.product.update({
        where: { id: parseInt(data.id) },
        data: payload,
      });
      
      await AuditService.log({
        userId: user.id,
        action: 'UPDATE_PRODUCT',
        entityType: 'PRODUCT',
        entityId: product.id,
        details: payload,
        branchId: payload.branchId
      });
    } else {
      product = await prisma.product.create({
        data: payload,
      });

      await AuditService.log({
        userId: user.id,
        action: 'CREATE_PRODUCT',
        entityType: 'PRODUCT',
        entityId: product.id,
        details: payload,
        branchId: payload.branchId
      });
    }

    return product;
  }

  static async deleteProduct(id: string | number, user: any) {
    const productId = parseInt(id as string);

    if (isNaN(productId)) {
      throw new Error("Invalid product ID format");
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { saleItems: { take: 1 } }
    });

    if (!product) {
      // If it doesn't exist on server, we consider it "deleted" (maybe it was local only)
      return;
    }

    // Check for sales history first
    const saleCount = await prisma.saleItem.count({
      where: { productId }
    });

    if (saleCount > 0) {
      throw new Error(`Cannot permanently delete '${product.name}' because it has ${saleCount} recorded sales. Please keep it in 'Trash' to preserve financial history.`);
    }

    // Clean up ratings first (non-critical)
    await prisma.productRating.deleteMany({
      where: { productId }
    });

    try {
      await prisma.product.delete({
        where: { id: productId }
      });

      await AuditService.log({
        userId: user.id,
        action: 'DELETE_PRODUCT_PERMANENT',
        entityType: 'PRODUCT',
        entityId: productId,
        branchId: product.branchId || user.branchId
      });
    } catch (error: any) {
      console.error('❌ Database Delete Error:', error);
      throw new Error("Database restriction: Failed to remove product record. It might be referenced by other system logs.");
    }
  }

  static async generateSku(categoryId: string, name: string) {
    const category = await prisma.category.findUnique({ where: { id: parseInt(categoryId) } });
    const catShort = (category?.title || 'XX').replace(/\s+/g, '').substring(0, 2).toUpperCase();
    const nameShort = name.replace(/\s+/g, '').substring(0, 3).toUpperCase();
    const prefix = `${catShort}-${nameShort}-`;

    const lastProduct = await prisma.product.findFirst({
      where: { sku: { startsWith: prefix } },
      orderBy: { sku: 'desc' }
    });

    let next = "001";
    if (lastProduct?.sku) {
      const matches = lastProduct.sku.match(/(\d{3})$/);
      if (matches) {
        next = (parseInt(matches[1] as string) + 1).toString().padStart(3, '0');
      }
    }

    return prefix + next;
  }
}
