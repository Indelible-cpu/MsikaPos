import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const listCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { title: 'asc' }
    });
    return res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
};

export const saveCategory = async (req: Request, res: Response) => {
  const { id, title, slug } = req.body;

  try {
    const category = await prisma.category.upsert({
      where: { id: parseInt(id) },
      update: { title, slug },
      create: { id: parseInt(id), title, slug }
    });

    return res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to save category', error: error.message });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Check if category has products
    const productCount = await prisma.product.count({
      where: { categoryId: parseInt(id) }
    });

    if (productCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete category: it still contains ${productCount} products.` 
      });
    }

    await prisma.category.delete({
      where: { id: parseInt(id) }
    });

    return res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete category', error: error.message });
  }
};
