import { prisma } from './lib/prisma';
import type { Product, Sale, Debt, DebtStatus, User } from '@shared/types';
import { calculateUnitCost } from '@shared/types';
import type { PlanName, User as PrismaUser } from '@prisma/client';

// --- Database Connection Check ---
export async function checkDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

// --- Product Actions ---
export async function getProducts(user: PrismaUser): Promise<Product[]> {
  try {
    const products = await prisma.product.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    return products.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })) as Product[];
  } catch (error) {
    console.error("Error fetching products:", error);
    throw new Error("Failed to fetch products.");
  }
}

export async function addProduct(user: PrismaUser, productData: Omit<Product, 'id' | 'createdAt' | 'userId' | 'user'>): Promise<Product | null> {
  if ((user as any).role !== 'ADMIN') {
    const userWithSubscription = await prisma.user.findUnique({
      where: { id: user.id },
      include: { subscription: { include: { plan: true } } },
    });

    const subscription = userWithSubscription?.subscription;
    let isPaidAndActive = false;
    if (subscription && subscription.plan.name !== 'GRATUITO' && subscription.isActive && (!subscription.endDate || new Date(subscription.endDate) >= new Date())) {
      isPaidAndActive = true;
    }

    if (!isPaidAndActive) {
      const productCount = await prisma.product.count({ where: { userId: user.id } });
      if (productCount >= 30) {
        throw new Error("O limite de 30 produtos para contas gratuitas, inativas ou expiradas foi atingido. Para adicionar mais, faça um upgrade do seu plano.");
      }
    }
  }

  const newProductData = {
    ...productData,
    userId: user.id,
    initialQuantity: productData.initialQuantity ?? productData.quantity,
  };
  try {
    const inserted = await prisma.product.create({ data: newProductData });
    return { ...inserted, createdAt: inserted.createdAt.toISOString() } as Product;
  } catch (error) {
    console.error("Error adding product:", error);
    throw new Error("Failed to add product.");
  }
}

export async function updateProduct(user: PrismaUser, productId: string, updates: Partial<Product>): Promise<Product | null> {
  try {
    const updated = await prisma.product.update({
      where: { id: productId, userId: user.id },
      data: updates,
    });
    return { ...updated, createdAt: updated.createdAt.toISOString() } as Product;
  } catch (error: any) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return null; // Record to update not found
    }
    console.error("Error updating product:", error);
    throw new Error("Failed to update product.");
  }
}

export async function deleteProduct(user: PrismaUser, productId: string): Promise<void> {
  try {
    await prisma.product.delete({ where: { id: productId, userId: user.id } });
  } catch (error) {
    console.error("Error deleting product:", error);
    throw new Error("Failed to delete product.");
  }
}

// --- Sale Actions ---
export async function getSales(user: PrismaUser): Promise<Sale[]> {
  try {
    const sales = await prisma.sale.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    return sales.map(s => ({ ...s, createdAt: s.createdAt.toISOString() })) as Sale[];
  } catch (error) {
    console.error("Error fetching sales:", error);
    throw new Error("Failed to fetch sales.");
  }
}

export async function addSale(user: PrismaUser, saleData: Omit<Sale, 'id' | 'createdAt' | 'productName' | 'profit' | 'userId' | 'user'>): Promise<Sale | null> {
  const product = await prisma.product.findFirst({
    where: { id: saleData.productId, userId: user.id },
  });

  if (!product) throw new Error("Product not found.");
  if (product.quantity < saleData.quantitySold) throw new Error("Insufficient stock.");

  const { cost: unitCost } = calculateUnitCost(product);
  const profit = saleData.isLoss ? -(unitCost * saleData.quantitySold) : saleData.saleValue - (unitCost * saleData.quantitySold);

  const newSaleData = {
    ...saleData,
    userId: user.id,
    productName: product.name,
    profit: profit,
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const createdSale = await tx.sale.create({ data: newSaleData });
      await tx.product.update({
        where: { id: saleData.productId },
        data: { quantity: { decrement: saleData.quantitySold } },
      });
      return createdSale;
    });
    return { ...result, createdAt: result.createdAt.toISOString() } as Sale;
  } catch (error) {
    console.error("Error adding sale:", error);
    throw new Error("Failed to add sale.");
  }
}

export async function updateSale(user: PrismaUser, saleId: string, updates: Partial<Sale>): Promise<Sale | null> {
  if (updates.quantitySold || updates.productId) {
    throw new Error("Updating quantity or product is not supported. Please delete and create a new sale.");
  }

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, userId: user.id },
    include: { product: true }
  });

  if (!sale) {
    return null; // Not found
  }

  const prismaUpdates: Partial<Sale> = { ...updates };

  // Recalculate profit if saleValue is updated
  if (updates.saleValue && sale.product) {
    const { cost: unitCost } = calculateUnitCost(sale.product);
    const newProfit = updates.saleValue - (unitCost * sale.quantitySold);
    if (updates.isLoss) {
        prismaUpdates.profit = -Math.abs(newProfit);
    } else {
        prismaUpdates.profit = newProfit;
    }
  }

  try {
    const updated = await prisma.sale.update({
      where: { id: saleId },
      data: prismaUpdates,
    });
    return { ...updated, createdAt: updated.createdAt.toISOString() } as Sale;
  } catch (error: any) {
    // This part of the code is unreachable because the sale is already found.
    // It is kept as a safeguard.
    if (error.code === 'P2025') {
      return null;
    }
    console.error("Error updating sale:", error);
    throw new Error("Failed to update sale.");
  }
}

export async function deleteSale(user: PrismaUser, saleId: string): Promise<void> {
  const saleToDelete = await prisma.sale.findFirst({
    where: { id: saleId, userId: user.id },
    include: { product: true },
  });

  if (!saleToDelete) throw new Error("Sale not found.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.sale.delete({ where: { id: saleId } });
      if (saleToDelete.product) {
        await tx.product.update({
          where: { id: saleToDelete.productId },
          data: { quantity: { increment: saleToDelete.quantitySold } },
        });
      }
    });
  } catch (error) {
    console.error("Error deleting sale:", error);
    throw new Error("Failed to delete sale.");
  }
}

// --- Debt Actions ---
export async function getDebts(user: PrismaUser): Promise<Debt[]> {
  try {
    const debts = await prisma.debt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    return debts.map(d => ({ ...d, createdAt: d.createdAt.toISOString(), dueDate: d.dueDate?.toISOString() || null, paidAt: d.paidAt?.toISOString() || null })) as Debt[];
  } catch (error) {
    console.error("Error fetching debts:", error);
    throw new Error("Failed to fetch debts.");
  }
}

export async function addDebt(user: PrismaUser, debtData: Omit<Debt, 'id' | 'createdAt' | 'status' | 'amountPaid' | 'userId' | 'user'>): Promise<Debt | null> {
  const newDebtData = {
    ...debtData,
    userId: user.id,
    status: 'PENDING' as DebtStatus,
    amountPaid: 0,
    dueDate: debtData.dueDate ? new Date(debtData.dueDate) : null,
    relatedSaleId: debtData.relatedSaleId || null,
  };
  try {
    const inserted = await prisma.debt.create({ data: newDebtData });
    return { ...inserted, createdAt: inserted.createdAt.toISOString(), dueDate: inserted.dueDate?.toISOString() || null, paidAt: inserted.paidAt?.toISOString() || null } as Debt;
  } catch (error) {
    console.error("Error adding debt:", error);
    throw new Error("Failed to add debt.");
  }
}

export async function updateDebt(user: PrismaUser, debtId: string, updates: Partial<Omit<Debt, 'id' | 'createdAt' | 'userId' | 'user'>>): Promise<Debt | null> {
  const prismaUpdates: Record<string, any> = { ...updates };

  if (updates.dueDate) prismaUpdates.dueDate = new Date(updates.dueDate);
  if (updates.paidAt) prismaUpdates.paidAt = new Date(updates.paidAt);

  try {
    const updated = await prisma.debt.update({
      where: { id: debtId, userId: user.id },
      data: prismaUpdates,
    });
    return { ...updated, createdAt: updated.createdAt.toISOString(), dueDate: updated.dueDate?.toISOString() || null, paidAt: updated.paidAt?.toISOString() || null } as Debt;
  } catch (error: any) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return null; // Record to update not found
    }
    console.error("Error updating debt:", error);
    throw new Error("Failed to update debt.");
  }
}

export async function deleteDebt(user: PrismaUser, debtId: string): Promise<void> {
  try {
    await prisma.debt.delete({ where: { id: debtId, userId: user.id } });
  } catch (error) {
    console.error("Error deleting debt:", error);
    throw new Error("Failed to delete debt.");
  }
}

export async function getInitialData(user: PrismaUser) {
    const [products, sales, debts] = await Promise.all([
        getProducts(user),
        getSales(user),
        getDebts(user),
    ]);
    return { products, sales, debts };
}

// --- Admin Actions ---
export async function getAllUsersWithSubscription(user: PrismaUser) {
  if ((user as any).role !== 'ADMIN') {
    throw new Error("Unauthorized: Only admins can access this resource.");
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subscription: {
          select: {
            id: true,
            plan: true,
            startDate: true,
            endDate: true,
            isActive: true,
          }
        }
      },
      orderBy: {
        name: 'asc',
      },
    });
    
    return users.map(user => ({
        ...user,
        subscription: user.subscription ? {
            ...user.subscription,
            startDate: user.subscription.startDate.toISOString(),
            endDate: user.subscription.endDate.toISOString(),
        } : null
    }));
  } catch (error) {
    console.error("Error fetching users with subscription:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
    }
    throw new Error("Failed to fetch users due to an unknown error.");
  }
}

export async function getPlans(user: PrismaUser) {
    if ((user as any).role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }
    return prisma.plan.findMany();
}

export async function createPlan(user: PrismaUser, planName: PlanName) {
    if ((user as any).role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    const existingPlan = await prisma.plan.findUnique({
        where: { name: planName },
    });

    if (existingPlan) {
        throw new Error(`O plano "${planName}" já existe.`);
    }

    return prisma.plan.create({
        data: {
            name: planName,
        },
    });
}

export async function updateUserSubscription(admin: PrismaUser, userId: string, planId: string, startDate: Date, endDate: Date, isActive: boolean) {
    if ((admin as any).role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    return prisma.subscription.upsert({
        where: { userId },
        update: {
            planId,
            startDate,
            endDate,
            isActive,
            activatedById: admin.id,
        },
        create: {
            userId,
            planId,
            startDate,
            endDate,
            isActive,
            activatedById: admin.id,
        },
    });
}

export async function deactivateSubscription(admin: PrismaUser, subscriptionId: string) {
    if ((admin as any).role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    return prisma.subscription.update({
        where: { id: subscriptionId },
        data: { isActive: false },
    });
}