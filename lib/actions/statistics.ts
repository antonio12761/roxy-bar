"use server";

import { prisma } from "@/lib/db";

export async function getProductStatistics() {
  try {
    // Get all products
    const allProducts = await prisma.prodotto.findMany({
      where: {
        NOT: {
          nome: {
            startsWith: "_CATEGORIA_PLACEHOLDER_"
          }
        }
      }
    });

    // Basic counts
    const totalProducts = allProducts.filter(p => !p.isDeleted).length;
    const availableProducts = allProducts.filter(p => !p.isDeleted && p.disponibile).length;
    const unavailableProducts = allProducts.filter(p => !p.isDeleted && !p.disponibile).length;
    const terminatedProducts = allProducts.filter(p => !p.isDeleted && p.terminato).length;

    // Calculate values
    const activeProducts = allProducts.filter(p => !p.isDeleted);
    const totalValue = activeProducts.reduce((sum, p) => sum + Number(p.prezzo), 0);
    const averagePrice = totalProducts > 0 ? totalValue / totalProducts : 0;

    // Price range
    const prices = activeProducts.map(p => Number(p.prezzo)).filter(p => p > 0);
    const priceRange = {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0
    };

    // Category statistics
    const categoryStats = new Map<string, { count: number; value: number }>();
    
    activeProducts.forEach(product => {
      const existing = categoryStats.get(product.categoria) || { count: 0, value: 0 };
      categoryStats.set(product.categoria, {
        count: existing.count + 1,
        value: existing.value + Number(product.prezzo)
      });
    });

    const topCategories = Array.from(categoryStats.entries())
      .map(([nome, stats]) => ({
        nome,
        count: stats.count,
        value: stats.value
      }))
      .sort((a, b) => b.count - a.count);

    // Price distribution
    const priceRanges = [
      { min: 0, max: 5, label: "€0 - €5" },
      { min: 5, max: 10, label: "€5 - €10" },
      { min: 10, max: 20, label: "€10 - €20" },
      { min: 20, max: 50, label: "€20 - €50" },
      { min: 50, max: 100, label: "€50 - €100" },
      { min: 100, max: Infinity, label: "€100+" }
    ];

    const priceDistribution = priceRanges.map(range => ({
      range: range.label,
      count: activeProducts.filter(p => Number(p.prezzo) >= range.min && Number(p.prezzo) < range.max).length
    }));

    // Destination statistics
    const destinationStats = {
      prepara: activeProducts.filter(p => p.postazione === "PREPARA").length,
      cucina: activeProducts.filter(p => p.postazione === "CUCINA").length,
      banco: activeProducts.filter(p => p.postazione === "BANCO").length
    };

    return {
      totalProducts,
      availableProducts,
      unavailableProducts,
      terminatedProducts,
      totalValue,
      averagePrice,
      priceRange,
      categoriesCount: categoryStats.size,
      topCategories,
      priceDistribution,
      destinationStats
    };
  } catch (error) {
    console.error("Error calculating statistics:", error);
    throw error;
  }
}

export async function getCategoryStatistics(categoryName?: string) {
  try {
    const whereClause: any = {
      NOT: {
        nome: {
          startsWith: "_CATEGORIA_PLACEHOLDER_"
        }
      },
      isDeleted: false
    };

    if (categoryName) {
      whereClause.categoria = categoryName;
    }

    const products = await prisma.prodotto.findMany({
      where: whereClause
    });

    return {
      total: products.length,
      available: products.filter(p => p.disponibile).length,
      unavailable: products.filter(p => !p.disponibile).length,
      terminated: products.filter(p => p.terminato).length,
      totalValue: products.reduce((sum, p) => sum + Number(p.prezzo), 0),
      averagePrice: products.length > 0 ? products.reduce((sum, p) => sum + Number(p.prezzo), 0) / products.length : 0,
      glutenFree: products.filter(p => p.glutenFree).length,
      vegan: products.filter(p => p.vegano).length,
      vegetarian: products.filter(p => p.vegetariano).length
    };
  } catch (error) {
    console.error("Error calculating category statistics:", error);
    throw error;
  }
}