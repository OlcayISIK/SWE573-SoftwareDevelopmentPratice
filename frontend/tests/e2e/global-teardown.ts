import { removeTestData } from "./support";

export default function globalTeardown() {
  removeTestData();
}
