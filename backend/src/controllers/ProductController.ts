import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const listProducts = async (req: Request, res: Response) => {
  const { q, categoryId, deleted } = req.query;
  const user = (req as any).user;

  try {
    const where: any = {
      deleted: deleted === '1',
    };

    if (q) {
      where.OR = [
        { name: { contains: q as string, mode: 'insensitive' } },
        { sku: { contains: q as string, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = parseInt(categoryId as string);
    }

    // Strict Branch Isolation
    if (user.role === 'SUPER_ADMIN') {
      if (user.branchId) where.branchId = user.branchId;
    } else {
      where.branchId = user.branchId;
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    const mapped = products.map((p: any) => ({
      ...p,
      costPrice: Number(p.costPrice),
      sellPrice: Number(p.sellPrice),
      discountValue: p.discountValue ? Number(p.discountValue) : 0,
    }));

    return res.status(200).json({ success: true, data: mapped });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch products', error: error.message });
  }
};

export const searchProducts = async (req: Request, res: Response) => {
    const { term } = req.query;
    const user = (req as any).user;

    if (!term) return res.json({ success: true, data: [] });

    try {
        const where: any = {
            deleted: false,
            OR: [
                { name: { contains: term as string, mode: 'insensitive' } },
                { sku: { contains: term as string, mode: 'insensitive' } },
            ]
        };

        // Strict Branch Isolation
        if (user.role === 'SUPER_ADMIN') {
            if (user.branchId) where.branchId = user.branchId;
        } else {
            where.branchId = user.branchId;
        }

        const products = await prisma.product.findMany({
            where,
            take: 40,
            select: {
                id: true,
                name: true,
                sellPrice: true,
                quantity: true,
                isService: true
            }
        });

        return res.json({
            success: true,
            data: products.map((p: any) => ({
                id: p.id,
                name: p.name,
                unit_price: Number(p.sellPrice),
                quantity: p.isService ? null : p.quantity,
                is_service: p.isService
            }))
        });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getProductTotals = async (req: Request, res: Response) => {
    const { categoryId, q, branchId } = req.query;
    const user = (req as any).user;

    try {
        const where: any = { deleted: false };
        if (categoryId) where.categoryId = parseInt(categoryId as string);
        if (q) {
            where.OR = [
                { name: { contains: q as string, mode: 'insensitive' } },
                { sku: { contains: q as string, mode: 'insensitive' } },
            ];
        }

        // Strict Branch Isolation
        const targetBranchId = user.role === 'SUPER_ADMIN' ? (user.branchId || (branchId ? parseInt(branchId as string) : undefined)) : user.branchId;
        if (targetBranchId) where.branchId = targetBranchId;
        else if (user.role !== 'SUPER_ADMIN') where.branchId = user.branchId;

        const products = await prisma.product.findMany({ where });

        const totals = products.reduce((acc: any, p: any) => ({
            total_cost: acc.total_cost + (Number(p.costPrice) * p.quantity),
            total_sell: acc.total_sell + (Number(p.sellPrice) * p.quantity),
            total_qty: acc.total_qty + p.quantity
        }), { total_cost: 0, total_sell: 0, total_qty: 0 });

        return res.status(200).json({
            success: true,
            data: {
                total_cost: Number(totals.total_cost),
                total_sell: Number(totals.total_sell),
                total_qty: Number(totals.total_qty),
                total_profit: Number(totals.total_sell - totals.total_cost)
            }
        });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const generateSku = async (req: Request, res: Response) => {
    const { categoryId, name } = req.body;

    if (!categoryId || !name) {
        return res.status(400).json({ success: false, message: "Missing category or name" });
    }

    try {
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

        return res.status(200).json({ success: true, data: { sku: prefix + next } });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const saveProduct = async (req: Request, res: Response) => {

  const data = req.body;
  const user = (req as any).user;

  try {
    const payload: any = {
        name: data.name,
        sku: data.sku,
        costPrice: Number(data.cost_price),
        sellPrice: Number(data.sell_price),
        quantity: Number(data.quantity),
        isService: !!data.is_service,
        imageUrl: data.image_url || data.imageUrl || null,
        categoryId: parseInt(data.category_id),
        branchId: user.role === 'SUPER_ADMIN' ? (data.branch_id ? parseInt(data.branch_id) : null) : user.branchId,
        discountType: data.discount_type || null,
        discountValue: data.discount_value ? Number(data.discount_value) : 0,
        discountStartDate: data.discount_start_date ? new Date(data.discount_start_date) : null,
        discountEndDate: data.discount_end_date ? new Date(data.discount_end_date) : null,
        updatedAt: new Date()
    };

    if (data.id) {
      await prisma.product.update({
        where: { id: parseInt(data.id) },
        data: payload,
      });
      return res.status(200).json({ success: true, message: "Product updated" });
    } else {
      await prisma.product.create({
        data: payload,
      });
      return res.status(201).json({ success: true, message: "Product created" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to save product', error: error.message });
  }
};
