import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ProductService } from '../services/ProductService';

export const listProducts = async (req: Request, res: Response) => {
  const { q, categoryId, deleted } = req.query;
  const user = (req as any).user;

  try {
    const products = await ProductService.listProducts({
      q: q as string,
      categoryId: categoryId as string,
      deleted: deleted === '1',
      user
    });

    return res.status(200).json({ success: true, data: products });
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
        const sku = await ProductService.generateSku(categoryId, name);
        return res.status(200).json({ success: true, data: { sku } });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const saveProduct = async (req: Request, res: Response) => {
  const data = req.body;
  const user = (req as any).user;

  try {
    const product = await ProductService.saveProduct(data, user);
    const isUpdate = data.id && parseInt(data.id) < 1000000000;
    
    return res.status(isUpdate ? 200 : 201).json({ 
      success: true, 
      message: isUpdate ? "Product updated" : "Product created", 
      data: { id: product.id } 
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to save product', error: error.message });
  }
};

export const rateProduct = async (req: Request, res: Response) => {
    const { productId, rating, comment, customerId } = req.body;

    if (!productId || !rating) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
        const productRating = await prisma.productRating.create({
            data: {
                productId: parseInt(productId as string),
                rating: parseInt(rating as string),
                comment: comment || null,
                customerId: customerId ? parseInt(customerId as string) : null
            }
        });

        return res.status(201).json({ success: true, data: productRating });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getProductRatings = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const ratings = await prisma.productRating.findMany({
            where: { productId: parseInt(id as string) },
            include: { customer: { select: { fullname: true } } },
            orderBy: { createdAt: 'desc' }
        });

        return res.status(200).json({ success: true, data: ratings });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteProduct = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    
    if (!id) return res.status(400).json({ success: false, message: "Missing product ID" });

    try {
        const productId = parseInt(id as string);
        if (isNaN(productId)) return res.status(400).json({ success: false, message: "Invalid product ID" });
        await ProductService.deleteProduct(productId, user);
        return res.status(200).json({ success: true, message: "Product deleted permanently" });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: 'Failed to delete product', error: error.message });
    }
};
