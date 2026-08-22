/**
 * Seeds a demo account with realistic data so a recruiter can click
 * "Explore Demo" and immediately see the product in action.
 * Free to run locally: `npm run db:seed`
 */
import { PrismaClient, TransactionType, AccountType, RecurringFrequency } from "@prisma/client";
import bcrypt from "bcryptjs";
import { subDays, subMonths, addDays } from "date-fns";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@finmate.app";
const DEMO_PASSWORD = "DemoPass123";

const CATEGORY_SEED = [
  { name: "Food", icon: "utensils", color: "#f97316" },
  { name: "Shopping", icon: "shopping-bag", color: "#8b5cf6" },
  { name: "Transport", icon: "car", color: "#0ea5e9" },
  { name: "Bills", icon: "receipt", color: "#ef4444" },
  { name: "Entertainment", icon: "clapperboard", color: "#ec4899" },
  { name: "Health", icon: "heart-pulse", color: "#22c55e" },
  { name: "Education", icon: "graduation-cap", color: "#6366f1" },
  { name: "Travel", icon: "plane", color: "#14b8a6" },
  { name: "Income", icon: "wallet", color: "#16a34a" },
  { name: "Other", icon: "more-horizontal", color: "#64748b" },
];

const MERCHANTS: Record<string, string[]> = {
  Food: ["Swiggy", "Zomato", "Starbucks", "Local Cafe"],
  Shopping: ["Amazon", "Flipkart", "Myntra"],
  Transport: ["Uber", "Ola", "Indian Oil Petrol"],
  Bills: ["Electricity Board", "Airtel Broadband", "Jio Recharge"],
  Entertainment: ["Netflix", "Spotify", "BookMyShow"],
  Health: ["Apollo Pharmacy", "Practo Consultation"],
  Education: ["Udemy", "Coursera"],
  Travel: ["MakeMyTrip", "IRCTC", "OYO Rooms"],
};

function randomBetween(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

async function main() {
  console.log("Seeding demo data...");

  // Clean up any prior demo user for idempotency
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.create({
    data: {
      name: "Demo User",
      email: DEMO_EMAIL,
      passwordHash,
      currency: "INR",
      monthlyIncome: 65000,
      onboarded: true,
      isDemo: true,
      preference: { create: {} },
      categories: {
        create: CATEGORY_SEED.map((c) => ({ ...c, isDefault: true })),
      },
    },
  });

  const categories = await prisma.category.findMany({ where: { userId: user.id } });
  const catByName = new Map(categories.map((c) => [c.name, c]));

  const accounts = await Promise.all([
    prisma.account.create({
      data: { userId: user.id, name: "HDFC Savings", type: AccountType.SAVINGS, balance: 52000, isDemo: true },
    }),
    prisma.account.create({
      data: { userId: user.id, name: "ICICI Bank", type: AccountType.BANK, balance: 28400, isDemo: true },
    }),
    prisma.account.create({
      data: { userId: user.id, name: "Cash Wallet", type: AccountType.CASH, balance: 5000, isDemo: true },
    }),
    prisma.account.create({
      data: { userId: user.id, name: "HDFC Credit Card", type: AccountType.CREDIT_CARD, balance: -8200, isDemo: true },
    }),
    prisma.account.create({
      data: { userId: user.id, name: "Zerodha Investments", type: AccountType.INVESTMENT, balance: 42000, isDemo: true },
    }),
  ]);

  // 40 realistic transactions over the last 60 days
  const expenseCategoryNames = Object.keys(MERCHANTS);
  const now = new Date();

  for (let i = 0; i < 6; i++) {
    // Salary income, once per month for the last few months
    await prisma.transaction.create({
      data: {
        userId: user.id,
        accountId: accounts[0].id,
        categoryId: catByName.get("Income")!.id,
        merchant: "Salary",
        amount: 65000,
        type: TransactionType.INCOME,
        date: subMonths(now, i),
        isDemo: true,
      },
    });
  }

  for (let i = 0; i < 40; i++) {
    const categoryName = expenseCategoryNames[randomBetween(0, expenseCategoryNames.length - 1)];
    const merchants = MERCHANTS[categoryName];
    const merchant = merchants[randomBetween(0, merchants.length - 1)];
    const amount = randomBetween(150, 4500);
    const account = accounts[randomBetween(0, 3)];

    await prisma.transaction.create({
      data: {
        userId: user.id,
        accountId: account.id,
        categoryId: catByName.get(categoryName)!.id,
        merchant,
        amount,
        type: TransactionType.EXPENSE,
        date: subDays(now, randomBetween(0, 58)),
        isDemo: true,
      },
    });
  }

  // Budgets for the current month
  const budget = await prisma.budget.create({
    data: { userId: user.id, month: now.getMonth() + 1, year: now.getFullYear(), isDemo: true },
  });

  const budgetLimits: Record<string, number> = {
    Food: 8000,
    Shopping: 6000,
    Transport: 3000,
    Bills: 5000,
    Entertainment: 2000,
  };

  for (const [name, limit] of Object.entries(budgetLimits)) {
    await prisma.budgetItem.create({
      data: { budgetId: budget.id, categoryId: catByName.get(name)!.id, limit },
    });
  }

  // Goals
  const emergencyGoal = await prisma.goal.create({
    data: {
      userId: user.id,
      name: "Emergency Fund",
      targetAmount: 100000,
      currentAmount: 65000,
      targetDate: new Date(now.getFullYear(), 11, 31),
      isDemo: true,
    },
  });
  await prisma.goalContribution.createMany({
    data: [
      { goalId: emergencyGoal.id, amount: 10000, date: subMonths(now, 3) },
      { goalId: emergencyGoal.id, amount: 12000, date: subMonths(now, 2) },
      { goalId: emergencyGoal.id, amount: 15000, date: subMonths(now, 1) },
    ],
  });

  await prisma.goal.create({
    data: {
      userId: user.id,
      name: "New Laptop",
      targetAmount: 80000,
      currentAmount: 22000,
      targetDate: addDays(now, 150),
      isDemo: true,
    },
  });

  // Recurring payments
  await prisma.recurringPayment.createMany({
    data: [
      {
        userId: user.id,
        name: "Netflix",
        amount: 649,
        frequency: RecurringFrequency.MONTHLY,
        categoryId: catByName.get("Entertainment")!.id,
        nextDueDate: addDays(now, 5),
        isDemo: true,
      },
      {
        userId: user.id,
        name: "Rent",
        amount: 25000,
        frequency: RecurringFrequency.MONTHLY,
        categoryId: catByName.get("Bills")!.id,
        nextDueDate: addDays(now, 2),
        isDemo: true,
      },
      {
        userId: user.id,
        name: "Internet",
        amount: 999,
        frequency: RecurringFrequency.MONTHLY,
        categoryId: catByName.get("Bills")!.id,
        nextDueDate: addDays(now, 12),
        isDemo: true,
      },
    ],
  });

  // A few notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: user.id,
        type: "BUDGET_WARNING",
        title: "Food budget warning",
        message: "You're close to your Food budget limit.",
      },
      {
        userId: user.id,
        type: "GOAL_MILESTONE",
        title: "Emergency Fund milestone",
        message: "You've reached 65% of your Emergency Fund goal.",
      },
      {
        userId: user.id,
        type: "RECURRING_UPCOMING",
        title: "Upcoming: Rent",
        message: "Rent (₹25,000) is due soon.",
      },
    ],
  });

  console.log("Demo data seeded.");
  console.log(`Demo login → email: ${DEMO_EMAIL} / password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
