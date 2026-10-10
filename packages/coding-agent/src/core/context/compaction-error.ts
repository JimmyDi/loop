/** No complete older turn needs summarizing under the recent-history budget. */
export class NothingToCompactError extends Error {
  constructor() {
    super("Nothing to compact");
    this.name = "NothingToCompactError";
  }
}
