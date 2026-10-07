import type { Schemas } from "@/api/types";

export type CurrentUser = Schemas["OwnProfile"];

export interface Credentials {
  email: string;
  password: string;
}
