import { z } from "zod";

export const demoSalesQuery = "loop_demo_sales";

export const demoSales = {
  rows: [
    { period: "Jan", revenue: 12400 },
    { period: "Feb", revenue: 13100 },
    { period: "Mar", revenue: 11800 },
    { period: "Apr", revenue: 14700 },
    { period: "May", revenue: 15400 },
    { period: "Jun", revenue: 16800 },
  ],
};

const demoSalesArgs = z.strictObject({});

export const openUiQueries = {
  [demoSalesQuery]: async (args: unknown) => {
    demoSalesArgs.parse(args);
    return demoSales;
  },
};
