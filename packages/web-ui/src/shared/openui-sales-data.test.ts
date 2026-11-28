import { expect, test } from "vitest";
import { z } from "zod";

import { demoSales, demoSalesQuery, openUiQueries } from "./openui-sales-data";

test("only accepts an empty argument object for the bundled sales query", async () => {
  await expect(openUiQueries[demoSalesQuery]({})).resolves.toEqual(demoSales);
  await expect(openUiQueries[demoSalesQuery]({ period: "Jan" })).rejects.toBeInstanceOf(z.ZodError);
  await expect(openUiQueries[demoSalesQuery](null)).rejects.toBeInstanceOf(z.ZodError);
});
